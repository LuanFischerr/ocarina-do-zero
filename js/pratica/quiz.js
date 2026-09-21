// Quiz "Qual nota é essa?": dedilhado → nota, nota → dedilhado e ouvir → nota. Registra acertos por nota (revisão espaçada).
import { nomeNota, rotuloCompleto, descreverDedilhado } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { criarQuiz } from '../fundamentos/exercicios.js';
import { registrarNota, estatisticasNotas, pesoRevisao, classificarNota } from '../progresso.js';
import { garantirAudio, tocarNota } from '../audio/sintese.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const RODADAS = 10;

export const MODOS_QUIZ = {
  'dedilhado-nota': { titulo: 'Dedilhado → nota', instrucao: 'Veja os furos cobertos e escolha a nota.' },
  'nota-dedilhado': { titulo: 'Nota → dedilhado', instrucao: 'Veja a nota e escolha o dedilhado certo.' },
  'ouvir-nota': { titulo: 'Ouvir → nota', instrucao: 'Ouça a nota e escolha o nome dela.' },
};

/** Sorteio ponderado sem repetição: notas que você erra mais ou está devendo revisão aparecem mais. */
function sortearPonderado(notas, n, est) {
  const pool = notas.slice();
  const saida = [];
  while (saida.length < n && pool.length) {
    const pesos = pool.map((x) => pesoRevisao(x.id, est));
    let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && r > pesos[i]) { r -= pesos[i]; i++; }
    saida.push(pool.splice(i, 1)[0]);
  }
  // se o pool for menor que n, completa repetindo
  while (saida.length < n) saida.push(notas[Math.floor(Math.random() * notas.length)]);
  return saida;
}

function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const rotuloOpcao = (id) => {
  const n = nomeNota(id);
  return `${rotuloCompleto(id)} <small>${n.letra}${n.enarmonica ? ' / ' + n.enarmonica.letra : ''}</small>`;
};

/** 3 alternativas erradas: prefere notas "vizinhas" (mais difíceis) misturadas com sorteadas. */
function distratores(alvo, pool) {
  const outras = pool.filter((n) => n.id !== alvo.id);
  const proximas = outras.filter((n) => Math.abs(n.midi - alvo.midi) <= 4);
  const escolha = embaralhar(proximas).slice(0, 2);
  for (const n of embaralhar(outras)) { if (escolha.length >= 3) break; if (!escolha.includes(n)) escolha.push(n); }
  return escolha;
}

const chave = (n) => n.cobertos.slice().sort().join('|');

export function montarQuiz({ O, modo, pool: nome = 'naturais', aoAcabar = () => {} }) {
  const todas = O.notas;
  const pool = nome === 'naturais' ? todas.filter((n) => nomeNota(n.id).natural) : todas;
  // "revisão": só notas em que você errou ou que já estão vencidas na revisão espaçada
  let alvos = pool;
  let semRevisao = false;
  if (nome === 'revisao') {
    const est0 = estatisticasNotas();
    alvos = todas.filter((n) => {
      const c = classificarNota(n.id, est0);
      return c.tipo === 'atencao' || (c.tentativas > 0 && c.vencida) || (c.erros > 0 && c.tipo !== 'dominada');
    });
    if (!alvos.length) { alvos = pool; semRevisao = true; }
  }
  const rodadas = nome === 'revisao' && !semRevisao ? Math.min(RODADAS, Math.max(5, alvos.length * 2)) : RODADAS;
  const erradas = [];

  const gerar = () => {
    erradas.length = 0;
    const est = estatisticasNotas();
    return sortearPonderado(alvos, Math.min(rodadas, Math.max(alvos.length, rodadas)), est).map((alvo) => {
      const nm = nomeNota(alvo.id);
      const d = descreverDedilhado(O.layout, alvo.cobertos);
      const texto = `mão esquerda: ${d.esquerda}; mão direita: ${d.direita}; sub-furos: ${d.subs ? 'cobrir ' + d.subs : 'abertos'}`;

      if (modo === 'nota-dedilhado') {
        // alternativas = dedilhados de outras notas (padrões diferentes)
        const alts = distratores(alvo, pool).filter((n) => chave(n) !== chave(alvo));
        const opcoes = embaralhar([alvo, ...alts.slice(0, 3)]);
        return {
          nota: alvo.id,
          enunciado: `Qual é o dedilhado de <b>${rotuloCompleto(alvo.id)}</b> <small>(${nm.letra})</small>?`,
          opcoes: opcoes.map((n, k) => {
            const m = criarOcarinaSVG(O.layout, { miniatura: true, descricao: `Opção ${k + 1}` });
            m.definirCobertos(n.cobertos);
            return `<span class="q-oc" aria-hidden="true">${m.svg.outerHTML}</span><span class="q-oc-txt">${descreverTxt(O, n)}</span>`;
          }),
          correta: opcoes.indexOf(alvo),
          explicacao: `${rotuloCompleto(alvo.id)}: ${texto}.`,
        };
      }

      const alternativas = embaralhar([alvo, ...distratores(alvo, pool)]);
      const base = {
        nota: alvo.id,
        opcoes: alternativas.map((n) => rotuloOpcao(n.id)),
        correta: alternativas.indexOf(alvo),
        explicacao: `É ${rotuloCompleto(alvo.id)} (${nm.letra}). ${texto}.`,
      };
      if (modo === 'ouvir-nota') {
        return {
          ...base,
          enunciado: 'Ouça a nota e escolha o nome dela.',
          extra: () => {
            const b = html('<button type="button" class="btn btn-primario">▶ Ouvir de novo</button>');
            b.addEventListener('click', () => tocarNota(alvo.midi, { duracao: 1.6 }));
            return b;
          },
          aoMostrar: () => { garantirAudio(); tocarNota(alvo.midi, { duracao: 1.6 }); },
        };
      }
      return {
        ...base,
        enunciado: 'Que nota é este dedilhado?',
        extra: () => {
          const m = criarOcarinaSVG(O.layout, { descricao: `Ocarina com os furos cobertos: ${texto}` });
          m.mostrarRotulos(true);
          m.definirCobertos(alvo.cobertos);
          const w = document.createElement('div');
          w.className = 'q-grande';
          w.append(m.svg);
          return w;
        },
      };
    });
  };

  const quiz = criarQuiz({
    instrucao: MODOS_QUIZ[modo].instrucao,
    gerar,
    aprovacao: 0,
    aoResponder: (p, certa) => { registrarNota(p.nota, certa); if (!certa) erradas.push(p.nota); },
    mensagemFim: (acertos, total) => {
      const lista = [...new Set(erradas)].map((id) => rotuloCompleto(id)).join(', ');
      const base = acertos === total ? 'Perfeito! ' : acertos >= total * 0.7 ? 'Muito bem! ' : 'Continue praticando. ';
      return `${base}${lista ? `Vale revisar: <b>${lista}</b>. Elas vão aparecer mais nas próximas rodadas.` : ''}`;
    },
    aoTerminar: (r) => aoAcabar(r),
  });
  quiz.semRevisao = semRevisao;
  return quiz;
}

function descreverTxt(O, n) {
  const d = descreverDedilhado(O.layout, n.cobertos);
  return `E: ${d.esquerda}<br>D: ${d.direita}${d.subs ? `<br>sub: ${d.subs}` : ''}`;
}
