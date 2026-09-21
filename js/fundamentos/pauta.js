// Pauta (5 linhas) em SVG, na clave de Sol. Só o suficiente para mostrar "onde a nota fica".
const NS = 'http://www.w3.org/2000/svg';
const IDX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const PASSO = 7; // px por meio-espaço (distância linha↔espaço)
const Y_BASE = 150; // y da linha de baixo (Mi 4)

/** Posição diatônica: cada letra sobe 1 passo (Mi4 = 30 = linha de baixo). */
export function passoDiatonico(id) {
  const m = id.match(/^([A-G])(#?)(\d)$/);
  return Number(m[3]) * 7 + IDX[m[1]];
}

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/**
 * @param id  ex.: 'C5' (a nota mostrada); sustenidos aparecem com ♯
 * @returns SVGElement
 */
export function desenharPauta(id, { descricao } = {}) {
  const svg = el('svg', { viewBox: '0 0 300 190', class: 'pauta-svg', role: 'img', 'aria-label': descricao ?? `Nota ${id} na pauta` });
  const x0 = 18, x1 = 282;

  // 5 linhas: passos pares de 30 a 38
  for (let p = 30; p <= 38; p += 2) {
    svg.append(el('line', { x1: x0, x2: x1, y1: Y_BASE - (p - 30) * PASSO, y2: Y_BASE - (p - 30) * PASSO, class: 'pauta-linha' }));
  }

  // clave de Sol, explicada de forma simples: a "espiral" abraça a 2ª linha, onde mora o Sol (G4)
  const yG = Y_BASE - 2 * PASSO;
  svg.append(el('circle', { cx: 52, cy: yG, r: 17, class: 'pauta-clave-aro' }));
  const g = el('text', { x: 52, y: yG, class: 'pauta-clave', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  g.textContent = 'G';
  svg.append(g);
  svg.append(el('line', { x1: 52, x2: 52, y1: yG + 17, y2: Y_BASE + 18, class: 'pauta-haste-clave' }));

  const p = passoDiatonico(id);
  const y = Y_BASE - (p - 30) * PASSO;
  const x = 170;

  // linhas suplementares (fora da pauta)
  for (let s = 40; s <= p; s += 2) {
    const ys = Y_BASE - (s - 30) * PASSO;
    svg.append(el('line', { x1: x - 20, x2: x + 20, y1: ys, y2: ys, class: 'pauta-linha' }));
  }
  for (let s = 28; s >= p; s -= 2) {
    const ys = Y_BASE - (s - 30) * PASSO;
    svg.append(el('line', { x1: x - 20, x2: x + 20, y1: ys, y2: ys, class: 'pauta-linha' }));
  }

  if (id.includes('#')) {
    const t = el('text', { x: x - 30, y, class: 'pauta-acidente', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    t.textContent = '♯';
    svg.append(t);
  }
  svg.append(el('ellipse', { cx: x, cy: y, rx: 10, ry: 7.2, transform: `rotate(-20 ${x} ${y})`, class: 'pauta-nota' }));
  // haste: para cima se a nota está abaixo da linha do meio (Si4), senão para baixo
  const paraCima = p < 34;
  svg.append(el('line', {
    x1: paraCima ? x + 9.4 : x - 9.4, x2: paraCima ? x + 9.4 : x - 9.4,
    y1: y, y2: paraCima ? y - 46 : y + 46, class: 'pauta-haste',
  }));
  return svg;
}
