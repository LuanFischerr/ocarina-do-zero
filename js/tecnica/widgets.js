// Widgets da Técnica. Cada um: ({ O, dados, passo }) => { el, destruir? }
import { nomeNota, rotuloCompleto } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { criarMedidor } from '../ocarina/medidor.js';
import { garantirAudio, tocarNota, tocarSequencia, iniciarSopro, centsDaPressao, frequenciaMidi } from '../audio/sintese.js';
import { ler, salvar } from '../estado.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Ocarina que troca entre horizontal/vertical conforme a largura do contêiner. */
function ocarinaResponsiva(slot, layout, opcoes, aoCriar) {
  let orient = null;
  const montar = () => {
    const nova = slot.clientWidth && slot.clientWidth < 560 ? 'vertical' : 'horizontal';
    if (nova === orient) return;
    orient = nova;
    const oc = criarOcarinaSVG(layout, { ...opcoes, orientacao: nova });
    slot.replaceChildren(oc.svg);
    aoCriar(oc, nova);
  };
  const ro = new ResizeObserver(montar);
  ro.observe(slot);
  montar();
  return () => ro.disconnect();
}

// ------------------------------------------------------------ mapa das mãos
function mapaMaos({ O }) {
  const el = html(`
    <div class="widget w-maos">
      <div class="w-linha" role="group" aria-label="Destacar">
        <button type="button" class="chip" data-foco="tudo" aria-pressed="true">Tudo</button>
        <button type="button" class="chip" data-foco="esquerda" aria-pressed="false">Mão esquerda</button>
        <button type="button" class="chip" data-foco="direita" aria-pressed="false">Mão direita</button>
        <button type="button" class="chip" data-foco="polegares" aria-pressed="false">Polegares (atrás)</button>
      </div>
      <div class="w-maos-svg"></div>
      <div class="w-maos-texto" aria-live="polite"></div>
      <p class="w-dica">A posição dos furos vem da sua foto e da tabela do fabricante. Confira na sua ocarina: com os 10 furos cobertos deve soar Dó 5.</p>
    </div>`);
  const slot = el.querySelector('.w-maos-svg');
  const texto = el.querySelector('.w-maos-texto');
  let foco = 'tudo';
  let atual = null;
  const nomeDedo = { 0: 'polegar', 1: 'indicador', 2: 'médio', 3: 'anelar', 4: 'mínimo' };

  function descrever() {
    const f = O.layout.furos;
    const lista = (mao) => Object.entries(f)
      .filter(([, h]) => h.mao === mao && h.tipo === 'dedo')
      .sort(([, a], [, b]) => a.dedo - b.dedo)
      .map(([, h]) => `<li><b>${h.dedo}</b> ${nomeDedo[h.dedo]}</li>`).join('');
    const blocos = {
      esquerda: `<div><h3>Mão esquerda</h3><ul>${lista('esquerda')}<li><b>P</b> polegar (atrás)</li></ul></div>`,
      direita: `<div><h3>Mão direita</h3><ul>${lista('direita')}<li><b>P</b> polegar (atrás)</li></ul></div>`,
      polegares: '<div><h3>Polegares</h3><ul><li>Cada polegar cobre um furo <b>atrás</b> da ocarina.</li><li>Ficam <b>retos</b>, apoiando o instrumento.</li><li>O polegar esquerdo é o primeiro a levantar (Ré 6) e o direito o segundo (Mi 6).</li></ul></div>',
    };
    const mostrar = foco === 'tudo' ? [blocos.esquerda, blocos.direita] : [blocos[foco]];
    texto.innerHTML = `<div class="w-maos-cols">${mostrar.join('')}</div>
      <p class="w-dica">Sub-furos: <b>A</b> (esquerda) e <b>B</b> (direita) ficam ao lado do dedo médio. Deslize a almofada para cobrir o furo grande e o pequeno juntos.</p>`;
  }
  function aplicarFoco() {
    if (!atual) return;
    atual.svg.classList.remove('foco-esquerda', 'foco-direita', 'foco-polegares');
    if (foco !== 'tudo') atual.svg.classList.add(`foco-${foco}`);
    el.querySelectorAll('[data-foco]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.foco === foco)));
    descrever();
  }
  const parar = ocarinaResponsiva(slot, O.layout, { descricao: 'Ocarina com as duas mãos: cada dedo cobre um furo' }, (oc) => {
    atual = oc;
    oc.mostrarRotulos(true);
    oc.definirCobertos(O.porId.get('C5').cobertos);
    aplicarFoco();
  });
  el.querySelectorAll('[data-foco]').forEach((b) => b.addEventListener('click', () => { foco = b.dataset.foco; aplicarFoco(); }));
  return { el, destruir: parar };
}

// ------------------------------------------------------------ referência de dedilhado
function refDedilhado({ O, passo }) {
  const ids = passo.notas ?? ['C5'];
  const el = html(`
    <div class="widget w-ref">
      ${passo.titulo ? `<h3 class="w-ref-tit">${esc(passo.titulo)}</h3>` : ''}
      <div class="w-ref-grade"></div>
    </div>`);
  const grade = el.querySelector('.w-ref-grade');
  for (const id of ids) {
    const n = O.porId.get(id);
    const card = html(`<div class="w-ref-card"><div class="w-mini"></div><p class="w-nome">${nomeNota(id).pt}</p><p class="w-sub">${nomeNota(id).letra} · ${frequenciaMidi(n.midi).toFixed(0)} Hz</p><button type="button" class="btn">▶ Ouvir referência</button></div>`);
    const m = criarOcarinaSVG(O.layout, { miniatura: true, descricao: `Dedilhado de ${rotuloCompleto(id)}` });
    m.definirCobertos(n.cobertos);
    card.querySelector('.w-mini').append(m.svg);
    card.querySelector('button').addEventListener('click', () => tocarNota(n.midi, { duracao: 2.2 }));
    grade.append(card);
  }
  return { el };
}

// ------------------------------------------------------------ simulador de sopro
function sopro({ O }) {
  const NOTAS = ['A4', 'C5', 'G5', 'C6'];
  const el = html(`
    <div class="widget w-sopro">
      <div class="w-linha" role="group" aria-label="Nota da simulação">
        ${NOTAS.map((id) => `<button type="button" class="chip" data-nota="${id}" aria-pressed="${id === 'C5'}">${nomeNota(id).pt}</button>`).join('')}
      </div>
      <label class="w-controle"><span>Força do sopro: <b class="forca">suave</b></span>
        <input type="range" min="0" max="100" value="40" aria-describedby="sopro-desc">
        <span class="w-extremos"><span>fraco demais</span><span>forte demais</span></span>
      </label>
      <div data-medidor></div>
      <p id="sopro-desc" class="w-dica sopro-desc" aria-live="polite"></p>
      <div class="w-linha"><button type="button" class="btn btn-primario" data-tocar>▶ Ouvir</button>
      <small class="w-dica">Simulação didática; os valores em cents são ilustrativos.</small></div>
    </div>`);
  const range = el.querySelector('input');
  const forcaEl = el.querySelector('.forca');
  const desc = el.querySelector('.sopro-desc');
  const botao = el.querySelector('[data-tocar]');
  const medidor = criarMedidor();
  el.querySelector('[data-medidor]').append(medidor.el);
  let nota = 'C5';
  let voz = null;

  const textos = [
    [0.1, 'fraco demais', 'Sopro fraco demais: a nota fica grave, fraca e cheia de ar.'],
    [0.27, 'um pouco fraco', 'Um pouco fraco: a nota fica levemente grave. Dê um pouco mais de ar.'],
    [0.5, 'suave', 'Sopro suave e constante: a nota fica afinada.'],
    [0.63, 'forçando', 'Já está forçando: a nota sobe e fica aguda.'],
    [1.01, 'forte demais', 'Forte demais: a nota fica bem aguda e áspera, quase estridente.'],
  ];
  function atualizar() {
    const p = range.value / 100;
    const [, rot, txt] = textos.find(([lim]) => p < lim);
    forcaEl.textContent = rot;
    desc.textContent = txt;
    const cents = centsDaPressao(p);
    medidor.definir(cents);
    voz?.definirPressao(p);
  }
  range.addEventListener('input', atualizar);
  el.querySelectorAll('[data-nota]').forEach((b) => b.addEventListener('click', () => {
    nota = b.dataset.nota;
    el.querySelectorAll('[data-nota]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (voz) { voz.parar(); voz = iniciarSopro(O.porId.get(nota).midi, { pressao: range.value / 100 }); }
  }));
  botao.addEventListener('click', () => {
    if (voz) { voz.parar(); voz = null; botao.textContent = '▶ Ouvir'; return; }
    garantirAudio();
    voz = iniciarSopro(O.porId.get(nota).midi, { pressao: range.value / 100 });
    botao.textContent = '⏸ Parar';
  });
  atualizar();
  return { el, destruir: () => voz?.parar() };
}

// ------------------------------------------------------------ nota longa (cronômetro)
function notaLonga({ O }) {
  const CHAVE = 'tecnica.notaLonga.melhor';
  const el = html(`
    <div class="widget w-longa">
      <h3 class="w-ref-tit">Exercício da nota longa</h3>
      <p class="w-dica">Cubra os furos de Dó 5 (ou Sol 5), comece limpo e sustente a nota suave e firme. Toque em <b>Começar</b> quando iniciar o sopro e em <b>Parar</b> quando acabar o ar. Meta: 8 segundos.</p>
      <div class="w-linha">
        <button type="button" class="chip" data-nota="C5" aria-pressed="true">Dó 5</button>
        <button type="button" class="chip" data-nota="G5" aria-pressed="false">Sol 5</button>
        <button type="button" class="btn" data-ref>▶ Ouvir referência</button>
      </div>
      <div class="w-longa-barra" aria-hidden="true"><i></i><span class="meta"></span></div>
      <p class="w-longa-tempo" aria-live="polite"><b class="seg">0,0</b> s <span class="w-dica melhor"></span></p>
      <button type="button" class="btn btn-primario" data-cron>▶ Começar</button>
    </div>`);
  const barra = el.querySelector('.w-longa-barra i');
  const segEl = el.querySelector('.seg');
  const melhorEl = el.querySelector('.melhor');
  const btn = el.querySelector('[data-cron]');
  let nota = 'C5';
  let t0 = 0;
  let raf = 0;
  const META = 8;

  const melhor = () => ler(CHAVE, 0);
  function mostrarMelhor() { melhorEl.textContent = melhor() ? `· melhor tempo: ${melhor().toFixed(1).replace('.', ',')} s` : ''; }
  function tick() {
    const s = (performance.now() - t0) / 1000;
    segEl.textContent = s.toFixed(1).replace('.', ',');
    barra.style.width = `${Math.min(100, (s / META) * 100)}%`;
    raf = requestAnimationFrame(tick);
  }
  btn.addEventListener('click', () => {
    if (raf) {
      cancelAnimationFrame(raf); raf = 0;
      const s = (performance.now() - t0) / 1000;
      if (s > melhor()) salvar(CHAVE, s);
      btn.textContent = '▶ Começar';
      mostrarMelhor();
      return;
    }
    t0 = performance.now();
    btn.textContent = '■ Parar';
    tick();
  });
  el.querySelectorAll('[data-nota]').forEach((b) => b.addEventListener('click', () => {
    nota = b.dataset.nota;
    el.querySelectorAll('[data-nota]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  el.querySelector('[data-ref]').addEventListener('click', () => tocarNota(O.porId.get(nota).midi, { duracao: 3 }));
  mostrarMelhor();
  return { el, destruir: () => cancelAnimationFrame(raf) };
}

// ------------------------------------------------------------ articulação
const ESTILOS = {
  ligado: { nome: 'Ligado (sem língua)', silaba: '—', ataque: 0.04, pico: 0.5, duracao: 1.0, soltar: 0.03, dica: 'O ar não para: só os dedos mudam a nota. As notas se emendam.' },
  tu: { nome: 'Tu (nítido)', silaba: 'tu', ataque: 0.012, pico: 0.62, duracao: 0.85, soltar: 0.04, dica: 'A língua interrompe e libera o ar: ataque definido, com um pequeno espaço entre as notas.' },
  du: { nome: 'Du (macio)', silaba: 'du', ataque: 0.035, pico: 0.52, duracao: 0.88, soltar: 0.05, dica: 'Mais macio que o "tu", bom para melodias cantadas.' },
  lu: { nome: 'Lu (bem suave)', silaba: 'lu', ataque: 0.07, pico: 0.45, duracao: 0.9, soltar: 0.06, dica: 'Quase sem ataque: a nota "nasce" do ar.' },
  curto: { nome: 'Curto (staccato)', silaba: 'tu', ataque: 0.01, pico: 0.6, duracao: 0.3, soltar: 0.03, dica: 'Notas curtas e separadas, com silêncio entre elas.' },
};

function articulacao({ O }) {
  const NOTAS = ['C5', 'D5', 'E5', 'F5'];
  const el = html(`
    <div class="widget w-artic">
      <div class="w-linha" role="group" aria-label="Estilo de ataque">
        ${Object.entries(ESTILOS).map(([k, e]) => `<button type="button" class="chip" data-estilo="${k}" aria-pressed="${k === 'tu'}">${e.nome}</button>`).join('')}
      </div>
      <svg class="w-artic-env" viewBox="0 0 560 130" role="img" aria-label="Formato do volume de cada nota"><path class="env" d="" /></svg>
      <div class="w-artic-silabas" aria-hidden="true"></div>
      <p class="w-dica w-artic-dica" aria-live="polite"></p>
      <div class="w-linha">
        <label class="w-inline">Andamento <b class="bpm">80</b> BPM <input type="range" min="50" max="120" value="80" aria-label="Andamento em BPM"></label>
        <button type="button" class="btn btn-primario" data-tocar>▶ Ouvir</button>
      </div>
    </div>`);
  const path = el.querySelector('.env');
  const silabas = el.querySelector('.w-artic-silabas');
  const dica = el.querySelector('.w-artic-dica');
  const range = el.querySelector('input');
  const bpmEl = el.querySelector('.bpm');
  let estilo = 'tu';
  let cancelar = null;

  function desenhar() {
    const e = ESTILOS[estilo];
    const beat = 60 / +range.value;
    const largNota = 540 / NOTAS.length;
    const px = largNota / beat; // px por segundo
    let d = 'M10 118';
    NOTAS.forEach((_, i) => {
      const x0 = 10 + i * largNota;
      const alt = 118 - (e.pico / 0.62) * 92;
      const xa = x0 + Math.min(e.ataque * px, largNota * 0.4);
      const xf = x0 + Math.min(e.duracao * beat * px, largNota);
      d += ` L${x0} 118 L${xa.toFixed(1)} ${alt.toFixed(1)} L${(xf - 4).toFixed(1)} ${(alt + 8).toFixed(1)} L${(xf + e.soltar * px).toFixed(1)} 118`;
    });
    d += ' L550 118';
    path.setAttribute('d', d);
    silabas.innerHTML = NOTAS.map((id) => `<span>${e.silaba}<small>${nomeNota(id).pt}</small></span>`).join('');
    dica.textContent = e.dica;
    bpmEl.textContent = range.value;
    el.querySelectorAll('[data-estilo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.estilo === estilo)));
  }
  function tocar() {
    cancelar?.();
    garantirAudio();
    const e = ESTILOS[estilo];
    const beat = 60 / +range.value;
    cancelar = tocarSequencia(NOTAS.map((id, i) => ({
      midi: O.porId.get(id).midi, inicio: i * beat, duracao: e.duracao * beat, pico: e.pico, ataque: e.ataque, soltar: e.soltar,
    })));
  }
  el.querySelectorAll('[data-estilo]').forEach((b) => b.addEventListener('click', () => { estilo = b.dataset.estilo; desenhar(); tocar(); }));
  range.addEventListener('input', desenhar);
  el.querySelector('[data-tocar]').addEventListener('click', tocar);
  desenhar();
  return { el, destruir: () => cancelar?.() };
}

// ------------------------------------------------------------ respiração guiada
function respiracao() {
  const PADROES = { '4-6': [4, 6], '3-5': [3, 5], '5-8': [5, 8] };
  const CICLOS = 4;
  const el = html(`
    <div class="widget w-resp">
      <div class="w-resp-palco">
        <div class="w-resp-bola" aria-hidden="true"></div>
        <p class="w-resp-fase" role="status" aria-live="polite">Pronto?</p>
      </div>
      <div class="w-linha">
        <label class="w-inline">Ritmo
          <select aria-label="Ritmo da respiração">
            ${Object.keys(PADROES).map((k) => `<option value="${k}">${k.replace('-', ' s inspirando · ')} s soltando</option>`).join('')}
          </select>
        </label>
        <button type="button" class="btn btn-primario" data-comecar>▶ Começar (${CICLOS} ciclos)</button>
      </div>
      <p class="w-dica">Mão na barriga: ela avança ao inspirar. Ombros parados. Sem esforço.</p>
    </div>`);
  const bola = el.querySelector('.w-resp-bola');
  const fase = el.querySelector('.w-resp-fase');
  const sel = el.querySelector('select');
  const btn = el.querySelector('[data-comecar]');
  let raf = 0;
  let rodando = false;

  function parar(msg = 'Pronto?') {
    cancelAnimationFrame(raf); raf = 0; rodando = false;
    btn.textContent = `▶ Começar (${CICLOS} ciclos)`;
    fase.textContent = msg;
    bola.style.transform = 'scale(0.55)';
  }
  function iniciar() {
    const [ins, sol] = PADROES[sel.value];
    const total = (ins + sol) * CICLOS;
    const t0 = performance.now();
    rodando = true;
    btn.textContent = '■ Parar';
    const passo = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= total) { parar('Muito bem! Respire normalmente.'); return; }
      const c = t % (ins + sol);
      const inspirando = c < ins;
      const restante = Math.ceil(inspirando ? ins - c : ins + sol - c);
      const prog = inspirando ? c / ins : 1 - (c - ins) / sol;
      fase.textContent = `${inspirando ? 'Inspire' : 'Solte o ar devagar'}… ${restante}`;
      if (!reduzMovimento()) bola.style.transform = `scale(${0.55 + 0.45 * prog})`;
      raf = requestAnimationFrame(passo);
    };
    passo();
  }
  btn.addEventListener('click', () => (rodando ? parar() : iniciar()));
  parar();
  return { el, destruir: () => cancelAnimationFrame(raf) };
}

// ------------------------------------------------------------ rotina de aquecimento
function rotina({ O, dados }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const CHAVE = `tecnica.rotina.${hoje}`;
  const passos = dados.rotina;
  let feitos = new Set(ler(CHAVE, []));
  const el = html(`
    <div class="widget w-rotina">
      <p class="w-rotina-prog" role="status" aria-live="polite"></p>
      <ol class="w-rotina-lista">
        ${passos.map((p) => `
          <li class="w-rotina-item" data-id="${p.id}">
            <label><input type="checkbox" data-id="${p.id}"> <span><b>${p.titulo}</b> <small>· ~${p.minutos} min</small><br><span class="w-dica">${p.detalhe}</span></span></label>
            ${p.ref ? `<button type="button" class="btn" data-ref="${p.id}" aria-label="Ouvir referência: ${esc(p.titulo.replace(/&quot;/g, ''))}">▶ Referência</button>` : ''}
          </li>`).join('')}
      </ol>
      <div class="w-linha"><button type="button" class="btn" data-zerar>Recomeçar o dia</button></div>
    </div>`);
  const prog = el.querySelector('.w-rotina-prog');
  let cancelar = null;

  function atualizar() {
    el.querySelectorAll('input[data-id]').forEach((c) => { c.checked = feitos.has(c.dataset.id); });
    el.querySelectorAll('.w-rotina-item').forEach((li) => li.classList.toggle('feito', feitos.has(li.dataset.id)));
    prog.textContent = feitos.size === passos.length
      ? '✓ Aquecimento completo hoje! Bom estudo.'
      : `${feitos.size} de ${passos.length} passos hoje`;
    salvar(CHAVE, [...feitos]);
  }
  el.addEventListener('change', (e) => {
    const c = e.target.closest('input[data-id]');
    if (!c) return;
    c.checked ? feitos.add(c.dataset.id) : feitos.delete(c.dataset.id);
    atualizar();
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ref]');
    if (b) {
      const p = passos.find((x) => x.id === b.dataset.ref);
      cancelar?.();
      garantirAudio();
      cancelar = tocarSequencia(p.ref.map((id, i) => ({ midi: O.porId.get(id).midi, inicio: i * (p.ref.length > 4 ? 0.7 : 1.2), duracao: p.ref.length > 4 ? 0.6 : 1.0 })));
    }
    if (e.target.closest('[data-zerar]')) { feitos = new Set(); atualizar(); }
  });
  atualizar();
  return { el, destruir: () => cancelar?.() };
}

// ------------------------------------------------------------ diagnóstico de erros
function diagnostico({ dados }) {
  const el = html(`
    <div class="widget w-diag">
      <div class="w-diag-lista" role="group" aria-label="Sintomas">
        ${dados.sintomas.map((s) => `<button type="button" class="chip w-diag-op" data-id="${s.id}" aria-pressed="false">${s.sintoma}</button>`).join('')}
      </div>
      <div class="w-diag-res cartao" aria-live="polite"><p class="w-dica">Escolha um sintoma para ver a causa provável e como corrigir.</p></div>
    </div>`);
  const res = el.querySelector('.w-diag-res');
  const titulos = Object.fromEntries((dados._topicos ?? []).map((t) => [t.id, t.titulo]));
  el.querySelectorAll('.w-diag-op').forEach((b) => b.addEventListener('click', () => {
    const s = dados.sintomas.find((x) => x.id === b.dataset.id);
    el.querySelectorAll('.w-diag-op').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    res.innerHTML = `
      <h3>${s.sintoma}</h3>
      <div class="w-diag-cols">
        <div><h4>Causas prováveis</h4><ul>${s.causas.map((c) => `<li>${c}</li>`).join('')}</ul></div>
        <div><h4>O que fazer</h4><ol>${s.correcoes.map((c) => `<li>${c}</li>`).join('')}</ol></div>
      </div>
      <p><a class="btn" href="#/tecnica/${s.topico}">Ver: ${esc(titulos[s.topico] ?? s.topico)} →</a></p>`;
  }));
  return { el };
}

export const WIDGETS_TECNICA = {
  'mapa-maos': mapaMaos,
  'ref-dedilhado': refDedilhado,
  sopro,
  'nota-longa': notaLonga,
  articulacao,
  respiracao,
  rotina,
  diagnostico,
};
