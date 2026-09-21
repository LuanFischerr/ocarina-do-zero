// Progresso das lições (localStorage). Formato: { [idLicao]: { concluida, acertos, total, quando } }
import { ler, salvar } from './estado.js';

const CHAVE = 'progresso.licoes';

export function progressoLicoes() {
  return ler(CHAVE, {}) || {};
}

export function registrarLicao(id, { acertos, total, aprovada }) {
  const p = progressoLicoes();
  const anterior = p[id];
  p[id] = {
    concluida: !!(aprovada || anterior?.concluida),
    acertos: Math.max(acertos, anterior?.acertos ?? 0),
    total,
    quando: new Date().toISOString(),
  };
  salvar(CHAVE, p);
  marcarDia();
  return p[id];
}

// ---- Técnica: tópicos marcados como "praticados" ----
const CHAVE_TEC = 'progresso.tecnica';

export function progressoTecnica() {
  return ler(CHAVE_TEC, {}) || {};
}

export function marcarTecnica(id, praticado) {
  const p = progressoTecnica();
  if (praticado) p[id] = { praticado: true, quando: new Date().toISOString() };
  else delete p[id];
  salvar(CHAVE_TEC, p);
  if (praticado) marcarDia();
  return p;
}

// ---- Notas: acertos/erros e revisão espaçada simples (caixas de Leitner) ----
const CHAVE_NOTAS = 'progresso.notas';
const INTERVALOS_DIAS = [0, 1, 2, 4, 8, 16]; // dias até revisar, por caixa (0 = agora)

export function estatisticasNotas() {
  return ler(CHAVE_NOTAS, {}) || {};
}

/** Registra uma tentativa. Acertou: sobe uma caixa. Errou: volta para a caixa 0. */
export function registrarNota(id, acertou) {
  const est = estatisticasNotas();
  const n = est[id] ?? { acertos: 0, erros: 0, caixa: 0 };
  if (acertou) { n.acertos++; n.caixa = Math.min(INTERVALOS_DIAS.length - 1, n.caixa + 1); }
  else { n.erros++; n.caixa = 0; }
  n.ultima = new Date().toISOString();
  n.revisar = new Date(Date.now() + INTERVALOS_DIAS[n.caixa] * 86400000).toISOString();
  est[id] = n;
  salvar(CHAVE_NOTAS, est);
  marcarDia();
  return n;
}

/** Peso para sortear notas em exercícios: mais peso para as que erra e as "vencidas" para revisão. */
export function pesoRevisao(id, est = estatisticasNotas()) {
  const n = est[id];
  if (!n) return 3; // nunca vista: bom prioridade
  const vencida = new Date(n.revisar) <= new Date() ? 2 : 0;
  return 1 + n.erros * 0.6 + (5 - n.caixa) * 0.5 + vencida;
}

// ---- Repertório: melhor resultado por música ----
const CHAVE_MUS = 'progresso.musicas';

export function progressoMusicas() {
  return ler(CHAVE_MUS, {}) || {};
}

/** Guarda o melhor resultado do modo guiado. "Dominada" = 85% ou mais de acertos em andamento de 90% ou mais. */
export function registrarMusica(id, { pct, andamentoPct, ok, total }) {
  const p = progressoMusicas();
  const m = p[id] ?? { tentativas: 0, melhorPct: 0, melhorAndamento: 0, dominada: false };
  m.tentativas++;
  m.ultima = new Date().toISOString();
  if (pct > m.melhorPct || (pct === m.melhorPct && andamentoPct > m.melhorAndamento)) {
    m.melhorPct = pct; m.melhorAndamento = andamentoPct; m.melhorOk = ok; m.melhorTotal = total;
  }
  if (pct >= 85 && andamentoPct >= 90) m.dominada = true;
  p[id] = m;
  salvar(CHAVE_MUS, p);
  marcarDia();
  return m;
}

// ---- Treinos do modo guiado ----
const CHAVE_TREINOS = 'progresso.treinos';

export function progressoTreinos() {
  return ler(CHAVE_TREINOS, {}) || {};
}

export function registrarTreino(id, { pct, andamentoPct, ok, total }) {
  const p = progressoTreinos();
  const t = p[id] ?? { tentativas: 0, melhorPct: 0, melhorAndamento: 0 };
  t.tentativas++;
  t.ultima = new Date().toISOString();
  if (pct > t.melhorPct || (pct === t.melhorPct && andamentoPct > t.melhorAndamento)) {
    t.melhorPct = pct; t.melhorAndamento = andamentoPct; t.melhorOk = ok; t.melhorTotal = total;
  }
  p[id] = t;
  salvar(CHAVE_TREINOS, p);
  marcarDia();
  return t;
}

// ---- Uso dos modos de prática (para a trilha sugerida) ----
const CHAVE_USOS = 'progresso.usos';

export function usos() {
  return ler(CHAVE_USOS, {}) || {};
}

export function registrarUso(chave) {
  const u = usos();
  const x = u[chave] ?? { vezes: 0 };
  x.vezes++;
  x.ultima = new Date().toISOString();
  u[chave] = x;
  salvar(CHAVE_USOS, u);
  marcarDia();
}

// ---- Dias de estudo e sequência ----
const CHAVE_DIAS = 'progresso.dias';
const dia = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function marcarDia() {
  const dias = ler(CHAVE_DIAS, []) || [];
  const hoje = dia();
  if (!dias.includes(hoje)) { dias.push(hoje); salvar(CHAVE_DIAS, dias.slice(-400)); }
}

export function diasDeEstudo() {
  const dias = new Set(ler(CHAVE_DIAS, []) || []);
  let seq = 0;
  const d = new Date();
  // a sequência conta a partir de hoje (ou de ontem, se hoje ainda não estudou)
  if (!dias.has(dia(d))) d.setDate(d.getDate() - 1);
  while (dias.has(dia(d))) { seq++; d.setDate(d.getDate() - 1); }
  return { total: dias.size, sequencia: seq, hoje: dias.has(dia()) };
}

// ---- Classificação das notas (domina / aprendendo / atenção) ----
/** tipo: nao-vista | dominada | aprendendo | atencao */
export function classificarNota(id, est = estatisticasNotas()) {
  const n = est[id];
  if (!n) return { tipo: 'nao-vista', tentativas: 0, taxa: null };
  const tentativas = n.acertos + n.erros;
  const taxa = tentativas ? n.acertos / tentativas : null;
  const vencida = new Date(n.revisar) <= new Date();
  let tipo = 'aprendendo';
  if (tentativas >= 3 && taxa < 0.6) tipo = 'atencao';
  else if (n.acertos >= 3 && n.caixa >= 3) tipo = 'dominada';
  return { tipo, tentativas, taxa, vencida, caixa: n.caixa, erros: n.erros, acertos: n.acertos };
}
