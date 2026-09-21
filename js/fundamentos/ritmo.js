// Ritmo: durações, símbolos (SVG original) e metrônomo com agendamento preciso pelo relógio do áudio.
import { garantirAudio, clique, relogio } from '../audio/sintese.js';

export const DURACOES = [
  { id: 'semibreve', nome: 'Semibreve', tempos: 4, descricao: 'dura 4 tempos' },
  { id: 'minima', nome: 'Mínima', tempos: 2, descricao: 'dura 2 tempos' },
  { id: 'seminima', nome: 'Semínima', tempos: 1, descricao: 'dura 1 tempo (a "batida")' },
  { id: 'colcheia', nome: 'Colcheia', tempos: 0.5, descricao: 'dura meio tempo' },
  { id: 'semicolcheia', nome: 'Semicolcheia', tempos: 0.25, descricao: 'dura um quarto de tempo' },
];

const SVG = (corpo, vb = '0 0 40 56') =>
  `<svg viewBox="${vb}" class="simbolo" aria-hidden="true" focusable="false">${corpo}</svg>`;
const cabeca = (cheia) =>
  `<ellipse cx="14" cy="42" rx="9" ry="6.2" transform="rotate(-22 14 42)" ${cheia ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2.6"'}/>`;
const haste = '<line x1="22.2" y1="39.5" x2="22.2" y2="8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
const bandeira = (y) =>
  `<path d="M22.2 ${y} C 30 ${y + 6}, 34 ${y + 12}, 30 ${y + 22}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`;

/** Símbolo de nota (figura). */
export function simboloNota(id) {
  switch (id) {
    case 'semibreve': return SVG(cabeca(false));
    case 'minima': return SVG(cabeca(false) + haste);
    case 'seminima': return SVG(cabeca(true) + haste);
    case 'colcheia': return SVG(cabeca(true) + haste + bandeira(8));
    case 'semicolcheia': return SVG(cabeca(true) + haste + bandeira(8) + bandeira(17));
    default: return '';
  }
}

/** Símbolo de pausa (silêncio) equivalente. */
export function simboloPausa(id) {
  const linha = '<line x1="4" y1="28" x2="36" y2="28" stroke="currentColor" stroke-width="1.4" opacity=".45"/>';
  switch (id) {
    case 'semibreve': return SVG(linha + '<rect x="11" y="28" width="18" height="8" fill="currentColor"/>');
    case 'minima': return SVG(linha + '<rect x="11" y="20" width="18" height="8" fill="currentColor"/>');
    case 'seminima':
      return SVG('<path d="M14 8 L26 22 L16 32 L27 44 C 20 42, 15 46, 20 52" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>');
    case 'colcheia':
      return SVG('<path d="M28 8 L14 50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="15" r="4.2" fill="currentColor"/><path d="M14 15 C 20 15, 24 13, 28 8" fill="none" stroke="currentColor" stroke-width="2.6"/>');
    case 'semicolcheia':
      return SVG('<path d="M28 6 L14 52" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="13" r="4" fill="currentColor"/><path d="M14 13 C 20 13, 24 11, 28 6" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="11" cy="25" r="4" fill="currentColor"/><path d="M11 25 C 17 25, 21 23, 25 18" fill="none" stroke="currentColor" stroke-width="2.4"/>');
    default: return '';
  }
}

/**
 * Metrônomo. Agenda cliques um pouco à frente no relógio do áudio (sem "tremer" como setInterval puro).
 * aoBatida(indiceNoCompasso, numeroDaBatida) é chamado no instante em que o clique soa.
 */
export function criarMetronomo({ bpm = 80, compasso = 4, aoBatida = () => {} } = {}) {
  let ac = null;
  let rodando = false;
  let proxima = 0;
  let contador = 0;
  let timer = null;
  const agendadas = []; // { t, n } para o teste de ritmo

  function agendar() {
    while (proxima < ac.currentTime + 0.15) {
      const i = contador % compasso;
      clique(proxima, i === 0);
      agendadas.push({ t: proxima, n: contador });
      const atraso = Math.max(0, (proxima - ac.currentTime) * 1000);
      const n = contador;
      setTimeout(() => { if (rodando) aoBatida(i, n); }, atraso);
      proxima += 60 / bpm;
      contador++;
    }
  }

  return {
    iniciar() {
      ac = garantirAudio();
      if (!ac || rodando) return;
      rodando = true;
      contador = 0;
      agendadas.length = 0;
      proxima = ac.currentTime + 0.12;
      agendar();
      timer = setInterval(agendar, 25);
    },
    parar() {
      rodando = false;
      clearInterval(timer);
      timer = null;
    },
    definirBpm(v) { bpm = v; },
    get rodando() { return rodando; },
    get batidas() { return agendadas; },
    get bpm() { return bpm; },
    agora: relogio,
  };
}

export function rotuloAndamento(bpm) {
  if (bpm < 60) return 'muito lento';
  if (bpm < 76) return 'lento';
  if (bpm < 108) return 'moderado';
  if (bpm < 132) return 'animado';
  return 'rápido';
}
