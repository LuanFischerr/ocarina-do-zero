// Widgets interativos das lições de Fundamentos. Cada um: ({ O }) => { el, destruir? }
import { nomeNota, rotuloCompleto } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { criarTeclado } from '../ocarina/teclado.js';
import { desenharPauta } from './pauta.js';
import { DURACOES, simboloNota, simboloPausa, criarMetronomo, rotuloAndamento } from './ritmo.js';
import { garantirAudio, tocarNota, tocarSequencia, iniciarTom, frequenciaMidi } from '../audio/sintese.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const A4 = 440;
const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Mini ocarina com o dedilhado de uma nota (reaproveita o SVG da etapa 1). */
function miniOcarina(O, id) {
  const nota = O.porId.get(id);
  const m = criarOcarinaSVG(O.layout, { miniatura: true, descricao: `Dedilhado de ${rotuloCompleto(id)}` });
  m.definirCobertos(nota.cobertos);
  return m.svg;
}

// ---------------------------------------------------------------- 1. altura
function widgetAltura() {
  const el = html(`
    <div class="widget w-altura">
      <svg class="onda" viewBox="0 0 600 120" role="img" aria-label="Onda sonora: mais ondas juntas significam som mais agudo"><path d="" fill="none"/></svg>
      <label class="w-controle">Altura do som
        <input type="range" min="0" max="100" value="35" aria-describedby="w-leitura">
        <span class="w-extremos"><span>grave</span><span>agudo</span></span>
      </label>
      <p id="w-leitura" class="w-leitura" aria-live="polite"><b class="hz"></b> · <span class="rot"></span></p>
      <div class="w-linha"><button type="button" class="btn btn-primario" data-tocar>▶ Ouvir</button>
      <small class="w-dica">O controle vai de 130 Hz a 1760 Hz. Sua ocarina Alto C fica entre 440 e 1397 Hz.</small></div>
    </div>`);
  const range = el.querySelector('input');
  const path = el.querySelector('path');
  const hzEl = el.querySelector('.hz');
  const rotEl = el.querySelector('.rot');
  const botao = el.querySelector('[data-tocar]');
  let tom = null;

  const freq = () => 130.8 * Math.pow(2, (range.value / 100) * 3.75);
  function desenhar() {
    const f = freq();
    const ciclos = 2 + 10 * (Math.log2(f / 130.8) / 3.75);
    let d = '';
    for (let x = 0; x <= 600; x += 3) {
      const y = 60 + 42 * Math.sin((x / 600) * ciclos * 2 * Math.PI);
      d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
    }
    path.setAttribute('d', d);
    hzEl.textContent = `${Math.round(f)} Hz`;
    rotEl.textContent = f < 300 ? 'grave' : f < 700 ? 'médio' : 'agudo';
    tom?.mudar(f);
  }
  range.addEventListener('input', desenhar);
  botao.addEventListener('click', () => {
    if (tom) { tom.parar(); tom = null; botao.textContent = '▶ Ouvir'; return; }
    garantirAudio();
    tom = iniciarTom(freq());
    botao.textContent = '⏸ Parar';
  });
  desenhar();
  return { el, destruir: () => tom?.parar() };
}

// ---------------------------------------------------------------- 2. as 7 notas
function widgetNotas7({ O }) {
  const NOTAS = [['C', 'Dó'], ['D', 'Ré'], ['E', 'Mi'], ['F', 'Fá'], ['G', 'Sol'], ['A', 'Lá'], ['B', 'Si']];
  const el = html(`
    <div class="widget w-notas7">
      <div class="w-notas-linha" role="group" aria-label="As sete notas">
        ${NOTAS.map(([l, pt]) => `<button type="button" class="nota-btn" data-l="${l}" aria-pressed="false"><span class="pt">${pt}</span><span class="lt">${l}</span></button>`).join('')}
      </div>
      <div class="w-notas-info">
        <div class="w-mini" aria-live="polite"></div>
        <div>
          <p class="w-nome">Escolha uma nota</p>
          <p class="w-sub">Toque para ouvir e ver como cobrir os furos da ocarina.</p>
          <button type="button" class="btn" data-escala>▶ Tocar a escala (Dó → Dó)</button>
        </div>
      </div>
    </div>`);
  const btns = [...el.querySelectorAll('.nota-btn')];
  const mini = el.querySelector('.w-mini');
  const nome = el.querySelector('.w-nome');
  const sub = el.querySelector('.w-sub');
  let cancelar = null;
  let timers = [];

  function marcar(l) {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === l)));
  }
  function mostrar(l, { tocar = true } = {}) {
    const id = `${l}5`;
    const n = O.porId.get(id);
    marcar(l);
    mini.replaceChildren(miniOcarina(O, id));
    const pt = NOTAS.find(([x]) => x === l)[1];
    nome.textContent = `${pt} = ${l}`;
    sub.textContent = `${nomeNota(id).pt} · ${frequenciaMidi(n.midi, A4).toFixed(0)} Hz`;
    if (tocar) tocarNota(n.midi, { a4: A4, duracao: 1 });
  }
  btns.forEach((b) => b.addEventListener('click', () => { pararEscala(); mostrar(b.dataset.l); }));

  function pararEscala() {
    cancelar?.(); cancelar = null;
    timers.forEach(clearTimeout); timers = [];
  }
  el.querySelector('[data-escala]').addEventListener('click', () => {
    pararEscala();
    garantirAudio();
    const ids = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
    const passo = 0.55;
    cancelar = tocarSequencia(ids.map((id, i) => ({ midi: O.porId.get(id).midi, inicio: i * passo, duracao: passo * 0.9 })), { a4: A4 });
    ids.forEach((id, i) => {
      timers.push(setTimeout(() => {
        const l = id[0];
        marcar(l);
        mini.replaceChildren(miniOcarina(O, id));
        nome.textContent = `${NOTAS.find(([x]) => x === l)[1]} = ${l}`;
        sub.textContent = `${nomeNota(id).pt} · ${frequenciaMidi(O.porId.get(id).midi, A4).toFixed(0)} Hz`;
      }, 50 + i * passo * 1000));
    });
  });
  mostrar('C', { tocar: false });
  marcar('');
  nome.textContent = 'Escolha uma nota';
  sub.textContent = 'Toque para ouvir e ver como cobrir os furos da ocarina.';
  mini.replaceChildren();
  return { el, destruir: pararEscala };
}

// ---------------------------------------------------------------- 3a. oitavas
function widgetOitavas({ O }) {
  const PARES = [['A', 'Lá'], ['B', 'Si'], ['C', 'Dó'], ['D', 'Ré'], ['E', 'Mi'], ['F', 'Fá']];
  const baixa = (l) => (l === 'A' || l === 'B' ? 4 : 5);
  const el = html(`
    <div class="widget w-oitavas">
      <div class="w-linha" role="group" aria-label="Escolha a nota">
        ${PARES.map(([l, pt]) => `<button type="button" class="chip" data-l="${l}" aria-pressed="false">${pt}</button>`).join('')}
      </div>
      <div class="w-oit-cards">
        <div class="w-oit-card" data-lado="baixa"><span class="w-oit-nome"></span><span class="w-oit-hz"></span><button type="button" class="btn" data-tocar="baixa">▶ Ouvir</button></div>
        <div class="w-oit-seta" aria-hidden="true">×2</div>
        <div class="w-oit-card" data-lado="alta"><span class="w-oit-nome"></span><span class="w-oit-hz"></span><button type="button" class="btn" data-tocar="alta">▶ Ouvir</button></div>
      </div>
      <button type="button" class="btn btn-primario" data-ambas>▶ Ouvir uma depois da outra</button>
      <p class="w-sub" aria-live="polite"></p>
    </div>`);
  let letra = 'C';
  let cancelar = null;
  const ids = () => [`${letra}${baixa(letra)}`, `${letra}${baixa(letra) + 1}`];

  function atualizar() {
    const [a, b] = ids();
    const fa = frequenciaMidi(O.porId.get(a).midi, A4);
    const fb = frequenciaMidi(O.porId.get(b).midi, A4);
    el.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.l === letra)));
    const cards = { baixa: [a, fa], alta: [b, fb] };
    for (const [lado, [id, f]] of Object.entries(cards)) {
      const c = el.querySelector(`[data-lado=${lado}]`);
      c.querySelector('.w-oit-nome').textContent = `${nomeNota(id).pt} (${nomeNota(id).letra})`;
      c.querySelector('.w-oit-hz').textContent = `${f.toFixed(1)} Hz`;
    }
    el.querySelector('.w-sub').textContent = `${fb.toFixed(1)} ÷ ${fa.toFixed(1)} = ${(fb / fa).toFixed(2)}: a nota de cima vibra o dobro.`;
  }
  el.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { letra = c.dataset.l; atualizar(); const [a] = ids(); tocarNota(O.porId.get(a).midi, { duracao: 0.9 }); }));
  el.querySelectorAll('[data-tocar]').forEach((b) => b.addEventListener('click', () => {
    cancelar?.();
    const [a, z] = ids();
    tocarNota(O.porId.get(b.dataset.tocar === 'baixa' ? a : z).midi, { duracao: 1 });
  }));
  el.querySelector('[data-ambas]').addEventListener('click', () => {
    cancelar?.();
    const [a, z] = ids();
    cancelar = tocarSequencia([
      { midi: O.porId.get(a).midi, inicio: 0, duracao: 0.8 },
      { midi: O.porId.get(z).midi, inicio: 1, duracao: 0.8 },
    ]);
  });
  atualizar();
  return { el, destruir: () => cancelar?.() };
}

// ---------------------------------------------------------------- 3b. teclado + semitons
function widgetTeclado({ O }) {
  const el = html(`
    <div class="widget w-teclado">
      <div class="w-linha">
        <span class="w-rotulo">Nome das teclas pretas:</span>
        <button type="button" class="chip" data-ac="sustenido" aria-pressed="true">♯ sustenido</button>
        <button type="button" class="chip" data-ac="bemol" aria-pressed="false">♭ bemol</button>
      </div>
      <div data-teclado></div>
      <div class="w-teclado-info">
        <div class="w-mini"></div>
        <div>
          <p class="w-nome" aria-live="polite">Toque em uma tecla</p>
          <p class="w-sub" aria-live="polite">Depois toque em outra para medir a distância em semitons.</p>
        </div>
      </div>
    </div>`);
  const nomeEl = el.querySelector('.w-nome');
  const subEl = el.querySelector('.w-sub');
  const mini = el.querySelector('.w-mini');
  let anterior = null;
  let modo = 'sustenido';

  const t = criarTeclado(O.notas, (id) => {
    const n = O.porId.get(id);
    const nm = nomeNota(id);
    t.marcar(id);
    tocarNota(n.midi, { duracao: 0.9 });
    mini.replaceChildren(miniOcarina(O, id));
    const pref = modo === 'bemol' && nm.enarmonica ? nm.enarmonica : nm;
    nomeEl.textContent = nm.enarmonica ? `${nm.pt} = ${nm.enarmonica.pt}` : `${nm.pt} (${nm.letra})`;
    if (anterior && anterior.id !== id) {
      const semitons = Math.abs(n.midi - anterior.midi);
      const tons = semitons / 2;
      subEl.textContent = `De ${nomeNota(anterior.id).pt} até ${pref.pt}: ${semitons} semiton${semitons > 1 ? 's' : ''} (${Number.isInteger(tons) ? tons + (tons === 1 ? ' tom' : ' tons') : tons.toString().replace('.', ',') + ' tons'}).`;
    } else {
      subEl.textContent = 'Toque em outra tecla para medir a distância em semitons.';
    }
    anterior = n;
  });
  el.querySelector('[data-teclado]').append(t.el);
  el.querySelectorAll('[data-ac]').forEach((b) => b.addEventListener('click', () => {
    modo = b.dataset.ac;
    t.definirAcidente(modo);
    el.querySelectorAll('[data-ac]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  return { el };
}

// ---------------------------------------------------------------- 4a. metrônomo
function widgetMetronomo() {
  const el = html(`
    <div class="widget w-metro">
      <div class="w-batidas" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      <label class="w-controle"><span>Andamento: <b class="bpm">80</b> BPM · <span class="rot"></span></span>
        <input type="range" min="40" max="160" value="80">
      </label>
      <div class="w-linha">
        <button type="button" class="btn btn-primario" data-tocar>▶ Iniciar</button>
        <span class="w-dica">A primeira batida de cada grupo de 4 é mais forte.</span>
      </div>
    </div>`);
  const bolas = [...el.querySelectorAll('.w-batidas span')];
  const range = el.querySelector('input');
  const botao = el.querySelector('[data-tocar]');
  const bpmEl = el.querySelector('.bpm');
  const rotEl = el.querySelector('.rot');
  const m = criarMetronomo({
    bpm: 80,
    aoBatida: (i) => {
      bolas.forEach((b, k) => b.classList.toggle('ativa', k === i));
    },
  });
  function ler() {
    m.definirBpm(+range.value);
    bpmEl.textContent = range.value;
    rotEl.textContent = rotuloAndamento(+range.value);
  }
  range.addEventListener('input', ler);
  botao.addEventListener('click', () => {
    if (m.rodando) { m.parar(); bolas.forEach((b) => b.classList.remove('ativa')); botao.textContent = '▶ Iniciar'; return; }
    m.iniciar();
    botao.textContent = '⏸ Parar';
  });
  ler();
  return { el, destruir: () => m.parar() };
}

// ---------------------------------------------------------------- 4b. durações e pausas
function widgetDuracoes({ O }) {
  const el = html(`
    <div class="widget w-duracoes">
      <div class="w-linha">
        <button type="button" class="chip" data-tipo="notas" aria-pressed="true">Notas</button>
        <button type="button" class="chip" data-tipo="pausas" aria-pressed="false">Pausas (silêncio)</button>
        <label class="w-inline">Andamento <b class="bpm">80</b> BPM <input type="range" min="40" max="160" value="80" aria-label="Andamento em BPM"></label>
      </div>
      <ul class="w-dur-lista"></ul>
    </div>`);
  const lista = el.querySelector('.w-dur-lista');
  const range = el.querySelector('input');
  const bpmEl = el.querySelector('.bpm');
  let tipo = 'notas';
  let cancelar = null;
  const G5 = O.porId.get('G5').midi;
  const MAX = 4; // a semibreve define a largura de 100%

  function desenhar() {
    lista.innerHTML = DURACOES.map((d) => `
      <li class="w-dur">
        <span class="w-dur-simb">${tipo === 'notas' ? simboloNota(d.id) : simboloPausa(d.id)}</span>
        <span class="w-dur-info"><b>${d.nome}${tipo === 'pausas' ? ' (pausa)' : ''}</b><small>${d.descricao}</small>
          <span class="w-dur-barra" aria-hidden="true"><i data-barra="${d.id}" style="width:${(d.tempos / MAX) * 100}%"></i></span></span>
        <button type="button" class="btn" data-dur="${d.id}" aria-label="${tipo === 'notas' ? 'Ouvir' : 'Sentir'} ${d.nome}">${tipo === 'notas' ? '▶' : '◻'}</button>
      </li>`).join('');
  }
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dur]');
    if (!b) return;
    cancelar?.();
    garantirAudio();
    const d = DURACOES.find((x) => x.id === b.dataset.dur);
    const seg = d.tempos * (60 / +range.value);
    if (tipo === 'notas') cancelar = tocarSequencia([{ midi: G5, inicio: 0, duracao: seg }]);
    const barra = lista.querySelector(`[data-barra=${d.id}]`);
    if (barra && !reduzMovimento()) {
      barra.animate([{ opacity: 1, filter: 'brightness(1.6)' }, { opacity: 0.55, filter: 'brightness(1)' }], { duration: seg * 1000, easing: 'linear' });
    }
  });
  el.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => {
    tipo = b.dataset.tipo;
    el.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    desenhar();
  }));
  range.addEventListener('input', () => { bpmEl.textContent = range.value; });
  desenhar();
  return { el, destruir: () => cancelar?.() };
}

// ---------------------------------------------------------------- 5. pauta
function widgetPauta({ O }) {
  const NATURAIS = O.notas.filter((n) => nomeNota(n.id).natural);
  const el = html(`
    <div class="widget w-pauta">
      <div class="w-pauta-corpo">
        <div class="w-pauta-svg" aria-live="polite"></div>
        <div class="w-pauta-lado">
          <p class="w-nome"></p>
          <p class="w-sub"></p>
          <div class="w-mini"></div>
        </div>
      </div>
      <div class="w-linha">
        <button type="button" class="btn" data-dir="-1" aria-label="Nota mais grave">▼ Mais grave</button>
        <button type="button" class="btn" data-dir="1" aria-label="Nota mais aguda">▲ Mais aguda</button>
        <button type="button" class="btn btn-primario" data-ouvir>▶ Ouvir</button>
      </div>
      <div class="w-pauta-letras" role="group" aria-label="Notas da ocarina">
        ${NATURAIS.map((n) => `<button type="button" class="chip" data-id="${n.id}" aria-pressed="false">${nomeNota(n.id).pt}</button>`).join('')}
      </div>
    </div>`);
  const svgBox = el.querySelector('.w-pauta-svg');
  const nomeEl = el.querySelector('.w-nome');
  const subEl = el.querySelector('.w-sub');
  const mini = el.querySelector('.w-mini');
  let idx = NATURAIS.findIndex((n) => n.id === 'C5');

  function mostrar(tocar = true) {
    const n = NATURAIS[idx];
    const nm = nomeNota(n.id);
    svgBox.replaceChildren(desenharPauta(n.id, { descricao: `${nm.pt} na pauta` }));
    nomeEl.textContent = `${nm.pt} · ${nm.letra}`;
    subEl.textContent = `${frequenciaMidi(n.midi, A4).toFixed(0)} Hz`;
    mini.replaceChildren(miniOcarina(O, n.id));
    el.querySelectorAll('[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === n.id)));
    if (tocar) tocarNota(n.midi, { duracao: 0.9 });
  }
  el.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => {
    idx = Math.min(NATURAIS.length - 1, Math.max(0, idx + Number(b.dataset.dir)));
    mostrar();
  }));
  el.querySelector('[data-ouvir]').addEventListener('click', () => tocarNota(NATURAIS[idx].midi, { duracao: 0.9 }));
  el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    idx = NATURAIS.findIndex((n) => n.id === b.dataset.id);
    mostrar();
  }));
  mostrar(false);
  return { el };
}

export const WIDGETS = {
  altura: widgetAltura,
  notas7: widgetNotas7,
  oitavas: widgetOitavas,
  teclado: widgetTeclado,
  metronomo: widgetMetronomo,
  duracoes: widgetDuracoes,
  pauta: widgetPauta,
};
