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
  return n;
}

/** Peso para sortear notas em exercícios: mais peso para as que erra e as "vencidas" para revisão. */
export function pesoRevisao(id, est = estatisticasNotas()) {
  const n = est[id];
  if (!n) return 3; // nunca vista: bom prioridade
  const vencida = new Date(n.revisar) <= new Date() ? 2 : 0;
  return 1 + n.erros * 0.6 + (5 - n.caixa) * 0.5 + vencida;
}
