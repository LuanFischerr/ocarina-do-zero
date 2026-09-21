// Carrega dedilhados/layout (JSON editável) e oferece utilitários de nomes de notas.
const NOMES_PT = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
const BEMOL = { 'C#': 'D', 'D#': 'E', 'F#': 'G', 'G#': 'A', 'A#': 'B' };

async function lerJSON(caminho) {
  const url = new URL(caminho, import.meta.url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não consegui carregar ${caminho} (${r.status})`);
  return r.json();
}

let cache = null;
/** Carrega uma vez só e reaproveita entre telas. */
export function obterOcarina() {
  cache ??= carregarOcarina().catch(e => { cache = null; throw e; });
  return cache;
}

async function carregarOcarina() {
  const [dados, layout] = await Promise.all([
    lerJSON('../../data/dedilhados.json'),
    lerJSON('../../data/ocarina-layout.json'),
  ]);
  const notas = dados.notas.slice().sort((a, b) => a.midi - b.midi);
  const porId = new Map(notas.map(n => [n.id, n]));
  return { dados, layout, notas, porId, indice: indexarPadroes(notas) };
}

/** "C#5" -> { letra:'C♯5', pt:'Dó♯5', enarmonica:{letra:'D♭5', pt:'Ré♭5'}|null, natural:false, oitava:5 } */
export function nomeNota(id) {
  const m = id.match(/^([A-G])(#?)(\d)$/);
  const [, l, sus, oit] = m;
  if (!sus) return { letra: `${l}${oit}`, pt: `${NOMES_PT[l]}${oit}`, natural: true, oitava: +oit, enarmonica: null };
  const bem = BEMOL[l + '#'];
  return {
    letra: `${l}♯${oit}`,
    pt: `${NOMES_PT[l]}♯${oit}`,
    natural: false,
    oitava: +oit,
    enarmonica: { letra: `${bem}♭${oit}`, pt: `${NOMES_PT[bem]}♭${oit}` },
  };
}

export function rotuloCompleto(id) {
  const n = nomeNota(id);
  return n.enarmonica ? `${n.pt} / ${n.enarmonica.pt}` : n.pt;
}

const chave = cobertos => [...cobertos].sort().join('|');

/** Mapa padrão-de-furos -> { nota, alternativa } (inclui alternativas). */
function indexarPadroes(notas) {
  const m = new Map();
  for (const n of notas) {
    m.set(chave(n.cobertos), { nota: n, alternativa: false });
    for (const alt of n.alternativas || []) {
      const k = chave(alt.cobertos);
      if (!m.has(k)) m.set(k, { nota: n, alternativa: true, alt });
    }
  }
  return m;
}

export function identificar(indice, cobertos) {
  return indice.get(chave(cobertos)) || null;
}

/** Nota cujo dedilhado difere em exatamente 1 furo (para dar dica de "quase lá"). */
export function quaseLa(notas, cobertos) {
  const s = new Set(cobertos);
  for (const n of notas) {
    const t = new Set(n.cobertos);
    const dif = [...s].filter(x => !t.has(x)).map(id => ({ id, acao: 'soltar' }))
      .concat([...t].filter(x => !s.has(x)).map(id => ({ id, acao: 'cobrir' })));
    if (dif.length === 1) return { nota: n, ...dif[0] };
  }
  return null;
}

/** Texto curto: "Mão esquerda: polegar, indicador… · Mão direita: …" */
export function descreverDedilhado(layout, cobertos) {
  const set = new Set(cobertos);
  const nomeDedo = { 0: 'polegar', 1: 'indicador', 2: 'médio', 3: 'anelar', 4: 'mínimo' };
  const porMao = { esquerda: [], direita: [] };
  const subs = [];
  for (const [id, f] of Object.entries(layout.furos)) {
    if (!set.has(id)) continue;
    if (f.tipo === 'sub') subs.push(id === 'sub_a' ? 'A' : 'B');
    else porMao[f.mao].push({ ordem: f.dedo, nome: nomeDedo[f.dedo] });
  }
  const fmt = arr => arr.sort((a, b) => a.ordem - b.ordem).map(x => x.nome).join(', ') || 'nenhum';
  return {
    esquerda: fmt(porMao.esquerda),
    direita: fmt(porMao.direita),
    subs: subs.length ? subs.join(' e ') : null,
    total: cobertos.length,
  };
}
