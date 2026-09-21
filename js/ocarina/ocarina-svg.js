// Ocarina em SVG, gerada a partir de data/ocarina-layout.json (posições dos furos parametrizadas).
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const f of filhos) if (f) e.append(f);
  return e;
}

const ROTULO_CURTO = { sub_a: 'A', sub_b: 'B' };
let contadorSVG = 0; // ids únicos de gradiente/filtro (a tabela desenha dezenas de miniaturas)

/**
 * @param layout  conteúdo de ocarina-layout.json
 * @param opcoes  { interativo, aoAlternar(id), orientacao: 'horizontal' | 'vertical', miniatura }
 */
export function criarOcarinaSVG(layout, { interativo = false, aoAlternar = () => {}, orientacao = 'horizontal', miniatura = false, descricao = null } = {}) {
  const uid = ++contadorSVG;
  const [vx, vy, vw, vh] = layout.viewBox;
  const vertical = orientacao === 'vertical';
  const caixa = vertical ? [0, 0, vh, vw] : [vx, vy, vw, vh];
  // vertical = gira 90° no sentido horário: boca à esquerda, mão esquerda em cima (igual à foto)
  const rotacaoGrupo = vertical ? `matrix(0 1 -1 0 ${vh} 0)` : '';

  const svg = el('svg', {
    viewBox: caixa.join(' '),
    class: miniatura ? 'ocarina-svg mini' : 'ocarina-svg',
    role: interativo ? 'group' : 'img',
    'aria-label': descricao ?? (interativo
      ? 'Ocarina de 12 furos. Toque nos furos para cobrir ou abrir.'
      : 'Ocarina de 12 furos com o dedilhado da nota escolhida.'),
  });

  svg.append(el('defs', {},
    (() => {
      const g = el('linearGradient', { id: `oc-grad-${uid}`, x1: '0', y1: '0', x2: '1', y2: '1' });
      g.append(
        el('stop', { offset: '0', 'stop-color': 'var(--oc-1)' }),
        el('stop', { offset: '0.55', 'stop-color': 'var(--oc-2)' }),
        el('stop', { offset: '1', 'stop-color': 'var(--oc-3)' }),
      );
      return g;
    })(),
    (() => {
      const f = el('filter', { id: `oc-sombra-${uid}`, x: '-10%', y: '-10%', width: '125%', height: '130%' });
      f.append(el('feDropShadow', { dx: '0', dy: '14', stdDeviation: '14', 'flood-color': '#0a0d3a', 'flood-opacity': '0.35' }));
      return f;
    })(),
  ));

  const raiz = el('g', rotacaoGrupo ? { transform: rotacaoGrupo } : {});
  svg.append(raiz);

  // corpo (contorno traçado sobre a foto, em coordenadas da foto -> transform do layout)
  const corpo = el('g', { transform: layout.corpo.transform, ...(miniatura ? {} : { filter: `url(#oc-sombra-${uid})` }) });
  corpo.append(
    el('path', { d: layout.corpo.path, class: 'oc-corpo', fill: `url(#oc-grad-${uid})` }),
    el('path', { d: layout.corpo.brilho, class: 'oc-brilho', fill: 'none' }),
  );
  raiz.append(corpo);

  // furos: polegares (atrás) primeiro, depois sub-furos e dedos
  const ordem = Object.entries(layout.furos).sort(([, a], [, b]) => (a.tipo === 'polegar' ? 0 : 1) - (b.tipo === 'polegar' ? 0 : 1));
  const furosEl = new Map();

  for (const [id, f] of ordem) {
    const verso = f.tipo === 'polegar';
    const g = el('g', {
      class: `furo tipo-${f.tipo} mao-${f.mao}`,
      'data-id': id,
      transform: `translate(${f.x} ${f.y})`,
    });
    const hit = el('circle', { class: 'furo-hit', r: Math.max(f.r + 14, 30) });
    const aro = el('circle', { class: 'furo-aro', r: f.r + 5 });
    const vazio = el('circle', { class: 'furo-vazio', r: f.r });
    const dedo = el('circle', { class: 'furo-dedo', r: f.r * 0.94 });
    const luz = el('circle', { class: 'furo-dedo-luz', r: f.r * 0.32, cx: -f.r * 0.28, cy: -f.r * 0.3 });
    const txtAttrs = { class: 'furo-rotulo', 'text-anchor': 'middle', 'dominant-baseline': 'central' };
    if (vertical) txtAttrs.transform = 'rotate(-90)';
    const rotulo = el('text', txtAttrs);
    rotulo.textContent = f.tipo === 'sub' ? ROTULO_CURTO[id] : f.tipo === 'polegar' ? 'P' : String(f.dedo);
    if (!miniatura) {
      const titulo = el('title');
      titulo.textContent = f.rotulo;
      g.append(titulo);
    }
    g.append(hit, aro, vazio, dedo, luz, rotulo);
    if (verso) g.classList.add('furo-verso');

    if (interativo) {
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-pressed', 'false');
      g.setAttribute('aria-label', `${f.rotulo}: aberto`);
      g.addEventListener('click', () => aoAlternar(id));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoAlternar(id); }
      });
    }
    raiz.append(g);
    furosEl.set(id, g);
  }

  let cobertosAtuais = new Set();

  function definirCobertos(lista, { destacarMudancas = false } = {}) {
    const novo = new Set(lista);
    for (const [id, g] of furosEl) {
      const antes = cobertosAtuais.has(id);
      const agora = novo.has(id);
      g.classList.toggle('coberto', agora);
      if (interativo) {
        g.setAttribute('aria-pressed', String(agora));
        g.setAttribute('aria-label', `${layout.furos[id].rotulo}: ${agora ? 'coberto' : 'aberto'}`);
      }
      g.classList.remove('mudou');
      if (destacarMudancas && antes !== agora) {
        void g.getBoundingClientRect(); // reinicia a animação
        g.classList.add('mudou');
      }
    }
    cobertosAtuais = novo;
  }

  return {
    svg,
    definirCobertos,
    obterCobertos: () => [...cobertosAtuais],
    mostrarRotulos(on) { svg.classList.toggle('com-rotulos', on); },
  };
}
