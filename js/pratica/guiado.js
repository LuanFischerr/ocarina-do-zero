// Modo guiado: as notas correm em direção à linha "agora", o dedilhado aparece na ocarina e o microfone avalia.
// Serve para os treinos (data/treinos.json) e, depois, para as músicas do repertório (mesmo formato de notas).
import { nomeNota, rotuloCompleto } from '../ocarina/dedilhados.js';
import { ocarinaResponsiva } from '../ocarina/ocarina-svg.js';
import { criarMicrofone } from '../audio/microfone.js';
import { criarPainelMic } from './painel-mic.js';
import { garantirAudio, contextoAudio, tocarSequencia, clique, pararNota } from '../audio/sintese.js';
import { registrarNota } from '../progresso.js';
import { ler, salvar } from '../estado.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CONTAGEM = 4;          // batidas de contagem antes de começar
const TOLERANCIA = 0.6;      // semitons: quanto a nota pode estar desafinada e ainda contar como "essa nota"
const ROTULOS_NIVEL = { 1: 'Nível 1 · básico', 2: 'Nível 2 · intermediário', 3: 'Nível 3 · desafio' };

/** Expande [{n,t}] em eventos com início/duração em tempos. */
export function montarEventos(O, notas) {
  let t = 0;
  return notas.map((x, i) => {
    const nota = x.n ? O.porId.get(x.n) : null;
    const ev = { i, id: x.n, midi: nota?.midi ?? null, nota, t0: t, dur: x.t, status: 'pendente', frames: 0, acertos: 0, somaCents: 0 };
    t += x.t;
    return ev;
  });
}

export function montarGuiado(raiz, { O, treinos, treinoId = null, titulo = 'Modo guiado', mostrarSeletor = true, aoResultado = null }) {
  const a4 = O.dados.referencia_a4_hz;
  const mic = criarMicrofone({ a4 });
  const painelMic = criarPainelMic(mic, { titulo: 'Microfone para a avaliação', aoSemMic: () => {} });

  let treino = treinos.find((t) => t.id === treinoId) ?? treinos[0];
  const el = html(`
    <div class="guiado">
      <div data-painel-mic></div>
      <div class="cartao g-ctrl">
        <label class="w-inline g-sel">Exercício
          <select data-treino aria-label="Exercício">
            ${treinos.map((t) => `<option value="${t.id}">${esc(t.titulo)}${t.nivel ? ` — ${ROTULOS_NIVEL[t.nivel] ?? ''}` : ''}</option>`).join('')}
          </select>
        </label>
        <p class="g-desc w-dica"></p>
        <div class="g-tempo">
          <label class="w-controle"><span>Andamento: <b class="g-pct">100</b>% · <b class="g-bpm"></b> BPM · <span class="g-rot"></span></span>
            <input type="range" min="40" max="120" step="5" value="100" data-pct aria-describedby="g-tempo-dica">
          </label>
          <div class="w-linha" role="group" aria-label="Andamentos rápidos">
            <button type="button" class="chip" data-preset="50">Lento (50%)</button>
            <button type="button" class="chip" data-preset="75">Médio (75%)</button>
            <button type="button" class="chip" data-preset="100">Normal (100%)</button>
          </div>
          <p id="g-tempo-dica" class="w-dica">Comece lento. Quando acertar quase tudo, aumente o andamento.</p>
        </div>
        <div class="g-botoes">
          <button type="button" class="btn" data-ouvir>▶ Ouvir primeiro</button>
          <button type="button" class="btn btn-primario" data-jogar>🎯 Tocar com avaliação</button>
          <button type="button" class="btn" data-parar disabled>■ Parar</button>
        </div>
        <div class="w-linha g-opcoes">
          <label><input type="checkbox" data-repetir> Repetir</label>
          <label><input type="checkbox" data-metro> Metrônomo sonoro <small>(use fones)</small></label>
        </div>
      </div>
      <div class="cartao g-palco">
        <canvas class="g-rolo" height="240" role="img" aria-label="Notas correndo em direção à linha agora; a altura indica a nota"></canvas>
        <p class="g-status" role="status" aria-live="polite">Escolha um exercício e toque em “Ouvir primeiro” ou em “Tocar com avaliação”.</p>
      </div>
      <div class="g-grade">
        <div class="cartao g-oc-cartao">
          <p class="g-agora" aria-live="polite"></p>
          <div class="g-oc"></div>
          <p class="w-dica g-prox"></p>
        </div>
        <div class="cartao g-resultado" hidden aria-live="polite"></div>
      </div>
    </div>`);

  el.querySelector('[data-painel-mic]').append(painelMic.el);
  const selTreino = el.querySelector('[data-treino]');
  const descEl = el.querySelector('.g-desc');
  const pctEl = el.querySelector('.g-pct');
  const bpmEl = el.querySelector('.g-bpm');
  const rotEl = el.querySelector('.g-rot');
  const range = el.querySelector('[data-pct]');
  const btnOuvir = el.querySelector('[data-ouvir]');
  const btnJogar = el.querySelector('[data-jogar]');
  const btnParar = el.querySelector('[data-parar]');
  const chkRepetir = el.querySelector('[data-repetir]');
  const chkMetro = el.querySelector('[data-metro]');
  const statusEl = el.querySelector('.g-status');
  const agoraEl = el.querySelector('.g-agora');
  const proxEl = el.querySelector('.g-prox');
  const resEl = el.querySelector('.g-resultado');
  const canvas = el.querySelector('.g-rolo');

  // ---------------- estado da sessão ----------------
  let eventos = [];
  let sessao = null;             // { modo, tStart, beat, ... } quando rodando
  let raf = 0;
  let cancelaDemo = null;
  let ocarina = null;
  let dedilhadoMostrado = null;
  const frames = [];             // leituras do microfone (t no relógio do áudio)
  let rodada = 0;

  selTreino.value = treino.id;
  if (!mostrarSeletor) el.querySelector('.g-sel').hidden = true;

  const bpmEfetivo = () => Math.round((treino.bpm * range.value) / 100);
  function atualizarRotulos() {
    pctEl.textContent = range.value;
    bpmEl.textContent = bpmEfetivo();
    const p = +range.value;
    rotEl.textContent = p <= 55 ? 'lento' : p <= 80 ? 'médio' : p <= 105 ? 'normal' : 'rápido';
    el.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.preset === p)));
  }
  function carregarTreino(t) {
    parar();
    treino = t;
    eventos = montarEventos(O, t.notas);
    descEl.textContent = `${t.foco ?? ''} Andamento normal: ${t.bpm} BPM · ${eventos.filter((e) => e.midi).length} notas.`;
    resEl.hidden = true;
    rodada = 0;
    atualizarRotulos();
    mostrarDedilhado(eventos.find((e) => e.nota) ?? null);
    proxEl.textContent = '';
    agoraEl.textContent = '';
    desenhar(0);
  }

  // ---------------- ocarina ----------------
  const pararOc = ocarinaResponsiva(el.querySelector('.g-oc'), O.layout, { descricao: 'Dedilhado da nota atual' }, (oc) => {
    ocarina = oc;
    oc.mostrarRotulos(true);
    oc.definirCobertos(dedilhadoMostrado ?? []);
  }, { limite: 460 });
  function mostrarDedilhado(ev) {
    const cob = ev?.nota ? ev.nota.cobertos : (dedilhadoMostrado ?? []);
    if (ev?.nota && dedilhadoMostrado?.join() === cob.join()) return;
    dedilhadoMostrado = cob;
    ocarina?.definirCobertos(cob, { destacarMudancas: true });
  }

  // ---------------- desenho do "rolo" de notas ----------------
  function cores() {
    const css = getComputedStyle(document.documentElement);
    const c = (n, f) => css.getPropertyValue(n).trim() || f;
    return {
      fundo: c('--superficie-2', '#f0e4c4'), linha: c('--borda', '#c4ae7c'), tinta: c('--tinta', '#2b2116'), suave: c('--tinta-suave', '#54452f'),
      azul: c('--azul-2', '#3b52c9'), ouro: c('--ouro', '#b58324'), verde: c('--verde', '#2b6444'), erro: c('--vermelho', '#9c311d'),
      inversa: c('--tinta-inversa', '#fdf8ea'), preta: c('--borda-forte', '#8d7748'),
    };
  }
  function desenhar(tRel) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = 240;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const C = cores();
    g.fillStyle = C.fundo; g.fillRect(0, 0, W, H);

    const midis = eventos.filter((e) => e.midi).map((e) => e.midi);
    if (!midis.length) return;
    let lo = Math.min(...midis) - 2;
    let hi = Math.max(...midis) + 2;
    if (hi - lo < 10) { const m = (hi + lo) / 2; lo = Math.floor(m - 5); hi = Math.ceil(m + 5); }
    const linhas = hi - lo + 1;
    const rowH = (H - 8) / linhas;
    const yDe = (m) => H - 4 - (m - lo + 0.5) * rowH;
    const nowX = Math.max(70, W * 0.24);
    const pxBeat = Math.max(46, Math.min(110, (W - nowX) / 6));

    // faixas por altura (teclas pretas mais escuras) + rótulos das naturais
    g.font = '600 11px system-ui, sans-serif';
    g.textBaseline = 'middle';
    for (let m = lo; m <= hi; m++) {
      const y = yDe(m);
      const preta = [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
      if (preta) { g.fillStyle = C.linha; g.globalAlpha = 0.25; g.fillRect(0, y - rowH / 2, W, rowH); g.globalAlpha = 1; }
      const id = idDeMidi(m);
      if (!preta) {
        g.fillStyle = C.suave;
        g.fillText(nomeNota(id).pt, 6, y);
        g.strokeStyle = C.linha; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(nowX - 8, y); g.lineTo(W, y); g.stroke(); g.globalAlpha = 1;
      }
    }

    // blocos
    for (const ev of eventos) {
      const x = nowX + (ev.t0 - tRel) * pxBeat;
      const w = ev.dur * pxBeat - 4;
      if (x + w < 0 || x > W) continue;
      if (!ev.midi) {
        g.setLineDash([5, 4]); g.strokeStyle = C.suave; g.lineWidth = 1.5;
        g.strokeRect(x, 10, Math.max(4, w), H - 20); g.setLineDash([]);
        g.fillStyle = C.suave; g.textAlign = 'left'; g.fillText(w > 44 ? 'pausa' : '·', x + 6, H / 2);
        continue;
      }
      const ativo = tRel >= ev.t0 && tRel < ev.t0 + ev.dur;
      const fill = ev.status === 'acerto' ? C.verde : ev.status === 'quase' ? C.ouro : ev.status === 'erro' ? C.erro : ativo ? C.ouro : C.azul;
      const y = yDe(ev.midi);
      g.fillStyle = fill;
      roundRect(g, x, y - rowH * 0.42, Math.max(6, w), rowH * 0.84, 5); g.fill();
      if (ativo) { g.strokeStyle = C.tinta; g.lineWidth = 2; roundRect(g, x, y - rowH * 0.42, Math.max(6, w), rowH * 0.84, 5); g.stroke(); }
      if (w > 34) {
        g.fillStyle = C.inversa; g.textAlign = 'left'; g.font = '700 12px system-ui, sans-serif';
        g.fillText(nomeNota(ev.id).pt, x + 6, y);
        g.font = '600 11px system-ui, sans-serif';
      }
    }

    // trilha do que você está tocando (microfone)
    if (sessao?.modo === 'jogar' && sessao.tStart != null && contextoAudio()) {
      const agora = contextoAudio().currentTime;
      g.strokeStyle = C.tinta; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
      let aberto = false;
      let ultimo = null;
      for (const f of frames) {
        const idade = agora - f.t;
        if (idade > 3) continue;
        if (f.midiFloat == null) { aberto = false; continue; }
        const x = nowX - (idade / sessao.beat) * pxBeat;
        const y = yDe(Math.max(lo - 0.5, Math.min(hi + 0.5, f.midiFloat)));
        if (!aberto) { g.moveTo(x, y); aberto = true; } else g.lineTo(x, y);
        ultimo = { x, y };
      }
      g.stroke();
      if (ultimo && agora - frames[frames.length - 1]?.t < 0.25) {
        g.fillStyle = C.tinta; g.beginPath(); g.arc(ultimo.x, ultimo.y, 6, 0, Math.PI * 2); g.fill();
      }
    }

    // linha "agora"
    g.strokeStyle = C.tinta; g.lineWidth = 2; g.beginPath(); g.moveTo(nowX, 0); g.lineTo(nowX, H); g.stroke();
    g.fillStyle = C.tinta; g.beginPath(); g.moveTo(nowX - 7, 0); g.lineTo(nowX + 7, 0); g.lineTo(nowX, 9); g.fill();

    // contagem
    if (sessao && tRel < 0) {
      g.fillStyle = C.tinta; g.globalAlpha = 0.85; g.textAlign = 'center'; g.font = '800 64px system-ui, sans-serif';
      g.fillText(String(Math.ceil(-tRel)), nowX + (W - nowX) / 2, H / 2);
      g.globalAlpha = 1; g.font = '600 11px system-ui, sans-serif';
    }
    g.textAlign = 'left';
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  const NOMES12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const idDeMidi = (m) => `${NOMES12[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

  // ---------------- execução ----------------
  function zerarEventos() {
    for (const e of eventos) { e.status = 'pendente'; e.frames = 0; e.acertos = 0; e.somaCents = 0; }
  }

  async function iniciar(modo) {
    if (sessao) return;
    const ac = garantirAudio();
    if (!ac) { statusEl.textContent = 'Este navegador não permite áudio.'; return; }
    if (modo === 'jogar' && mic.estado !== 'ativo' && !painelMic.semMic) {
      statusEl.textContent = 'Para avaliar, ative o microfone acima, ou escolha “Continuar sem microfone”.';
      painelMic.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    zerarEventos();
    frames.length = 0;
    resEl.hidden = true;
    const beat = 60 / bpmEfetivo();
    const avaliar = modo === 'jogar' && mic.estado === 'ativo';
    const tStart = ac.currentTime + 0.35 + (modo === 'demo' ? 0 : CONTAGEM * beat);
    const cliques = [];
    if (modo !== 'demo') for (let k = 0; k < CONTAGEM; k++) { clique(tStart - (CONTAGEM - k) * beat, k === 0); cliques.push(tStart - (CONTAGEM - k) * beat); }
    if (modo === 'jogar' && chkMetro.checked) {
      const total = eventos.at(-1).t0 + eventos.at(-1).dur;
      for (let k = 0; k < total; k++) { clique(tStart + k * beat, k % 4 === 0); cliques.push(tStart + k * beat); }
    }
    if (modo === 'demo') {
      const lead = tStart - ac.currentTime - 0.05;
      cancelaDemo = tocarSequencia(eventos.filter((e) => e.midi).map((e) => ({ midi: e.midi, inicio: lead + e.t0 * beat, duracao: e.dur * beat * 0.92 })), { a4 });
    }
    sessao = { modo, tStart, beat, avaliar, cliques, fim: eventos.at(-1).t0 + eventos.at(-1).dur };
    btnParar.disabled = false; btnOuvir.disabled = true; btnJogar.disabled = true; selTreino.disabled = true;
    statusEl.textContent = modo === 'demo' ? 'Ouvindo o exercício…' : avaliar ? 'Contagem… prepare o sopro suave.' : 'Acompanhe as notas (sem avaliação).';
    rodada++;
    loop();
  }

  function loop() {
    const ac = contextoAudio();
    if (!sessao || !ac) return;
    const tRel = (ac.currentTime - sessao.tStart) / sessao.beat;

    // avaliação das notas que terminaram
    if (sessao.avaliar) for (const ev of eventos) {
      if (ev.midi && ev.status === 'pendente' && ac.currentTime > sessao.tStart + (ev.t0 + ev.dur) * sessao.beat + 0.22) avaliarNota(ev);
    }

    // nota atual / próxima
    const atual = eventos.find((e) => tRel >= e.t0 && tRel < e.t0 + e.dur);
    const proxima = eventos.find((e) => e.t0 > tRel && e.midi) ?? null;
    if (tRel < 0) {
      const primeira = eventos.find((e) => e.midi);
      mostrarDedilhado(primeira);
      agoraEl.textContent = `Prepare: ${primeira ? rotuloCompleto(primeira.id) : ''}`;
    } else if (atual) {
      if (atual.midi) { mostrarDedilhado(atual); agoraEl.textContent = `Agora: ${rotuloCompleto(atual.id)}`; }
      else { agoraEl.textContent = 'Pausa: respire.'; if (proxima) mostrarDedilhado(proxima); }
      proxEl.textContent = proxima && proxima !== atual ? `Depois: ${rotuloCompleto(proxima.id)}` : 'Última nota';
    }

    desenhar(tRel);
    if (tRel > sessao.fim + 0.4) return terminar();
    raf = requestAnimationFrame(loop);
  }

  function avaliarNota(ev) {
    const beat = sessao.beat;
    const durS = ev.dur * beat;
    const ini = sessao.tStart + ev.t0 * beat + Math.min(0.3 * durS, 0.2);
    const fim = sessao.tStart + (ev.t0 + ev.dur) * beat + 0.2;
    const janela = frames.filter((f) => f.t >= ini && f.t <= fim && !sessao.cliques.some((c) => Math.abs(f.t - c) < 0.07));
    const hits = janela.filter((f) => f.midiFloat != null && Math.abs(f.midiFloat - ev.midi) <= TOLERANCIA);
    ev.frames = janela.length;
    ev.acertos = hits.length;
    ev.somaCents = hits.reduce((s, f) => s + (f.midiFloat - ev.midi) * 100, 0);
    const razao = janela.length ? hits.length / janela.length : 0;
    ev.status = hits.length >= 3 && razao >= 0.45 ? 'acerto' : hits.length >= 2 && razao >= 0.25 ? 'quase' : 'erro';
    registrarNota(ev.id, ev.status === 'acerto');
  }

  function terminar() {
    const s = sessao;
    cancelAnimationFrame(raf);
    sessao = null;
    btnParar.disabled = true; btnOuvir.disabled = false; btnJogar.disabled = false; selTreino.disabled = false;
    if (s.modo === 'demo') {
      statusEl.textContent = 'Fim da demonstração. Agora é a sua vez: “Tocar com avaliação”.';
    } else if (s.avaliar) {
      for (const ev of eventos) if (ev.midi && ev.status === 'pendente') avaliarNota(ev);
      mostrarResultado();
    } else {
      statusEl.textContent = 'Exercício concluído (sem avaliação). Para receber feedback, ative o microfone.';
    }
    desenhar(s.fim + 1);
    if (s.modo === 'jogar' && chkRepetir.checked && s.avaliar) setTimeout(() => { if (!sessao && chkRepetir.checked) iniciar('jogar'); }, 1800);
  }

  function parar() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    cancelaDemo?.(); cancelaDemo = null;
    pararNota(0.05);
    if (sessao) {
      sessao = null;
      btnParar.disabled = true; btnOuvir.disabled = false; btnJogar.disabled = false; selTreino.disabled = false;
      statusEl.textContent = 'Parado.';
    }
    if (eventos.length) desenhar(0);
  }

  function mostrarResultado() {
    const notas = eventos.filter((e) => e.midi);
    const ok = notas.filter((e) => e.status === 'acerto').length;
    const quase = notas.filter((e) => e.status === 'quase').length;
    const pct = Math.round((ok / notas.length) * 100);
    const hits = notas.filter((e) => e.acertos > 0);
    const totalHits = hits.reduce((s, e) => s + e.acertos, 0);
    const desvio = totalHits ? hits.reduce((s, e) => s + e.somaCents, 0) / totalHits : null;
    let afinacao = '';
    if (desvio != null) {
      afinacao = Math.abs(desvio) <= 12 ? 'Sua afinação média ficou boa.'
        : desvio > 0 ? `Você tende a soprar forte: em média ${Math.round(desvio)} cents acima. Alivie o sopro.`
          : `Você tende a soprar fraco: em média ${Math.round(-desvio)} cents abaixo. Confira vazamentos e o fôlego.`;
    }
    const bpmAtual = bpmEfetivo();
    const sugestao = pct >= 85 ? `Ótimo! Tente um andamento maior (por exemplo ${Math.min(Math.round(treino.bpm * 1.2), Math.round(bpmAtual * 1.2))} BPM).`
      : pct < 50 ? `Tente mais lento (por exemplo ${Math.max(30, Math.round(bpmAtual * 0.75))} BPM) e olhe o dedilhado antes de cada nota.` : 'Bom caminho: repita algumas vezes no mesmo andamento.';
    resEl.hidden = false;
    resEl.dataset.ok = String(pct >= 70);
    resEl.innerHTML = `
      <h3>Resultado${rodada > 1 ? ` · rodada ${rodada}` : ''}</h3>
      <p class="g-res-grande">${ok} de ${notas.length} notas <small>(${pct}%)</small>${quase ? ` · ${quase} quase` : ''}</p>
      <ul class="g-res-notas" aria-label="Resultado por nota">
        ${notas.map((e) => `<li class="s-${e.status}" title="${nomeNota(e.id).pt}: ${e.acertos} de ${e.frames} leituras na nota certa" data-hits="${e.acertos}" data-frames="${e.frames}"><span aria-hidden="true">${e.status === 'acerto' ? '✓' : e.status === 'quase' ? '~' : '✗'}</span> ${nomeNota(e.id).pt}<span class="sr-only"> ${e.status}</span></li>`).join('')}
      </ul>
      <p>${afinacao}</p>
      <p class="w-dica">${sugestao}</p>
      <button type="button" class="btn btn-primario" data-de-novo>↻ Tentar de novo</button>`;
    statusEl.textContent = `Terminou: ${ok} de ${notas.length} notas certas.`;
    aoResultado?.({ treino, ok, total: notas.length, pct, andamentoPct: +range.value, bpm: bpmAtual });
    resEl.querySelector('[data-de-novo]').addEventListener('click', () => iniciar('jogar'));
    resEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------------- ligações ----------------
  const desinscreverLeitura = mic.aoLeitura((l) => {
    if (!sessao?.avaliar) return;
    frames.push({ t: l.t - 0.04, midiFloat: l.freq ? l.midiFloat : null }); // -40 ms: a janela de análise olha para trás
    if (frames.length > 400) frames.splice(0, frames.length - 400);
  });
  selTreino.addEventListener('change', () => carregarTreino(treinos.find((t) => t.id === selTreino.value)));
  range.addEventListener('input', () => { atualizarRotulos(); salvar('guiado.pct', +range.value); });
  el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { range.value = b.dataset.preset; atualizarRotulos(); salvar('guiado.pct', +range.value); }));
  btnOuvir.addEventListener('click', () => iniciar('demo'));
  btnJogar.addEventListener('click', async () => {
    if (mic.estado !== 'ativo' && !painelMic.semMic && painelMic.suportado) { await mic.iniciar(); }
    iniciar('jogar');
  });
  btnParar.addEventListener('click', parar);
  window.addEventListener('resize', () => { if (!sessao) desenhar(0); });

  range.value = String(ler('guiado.pct', 100));
  raiz.append(el);
  carregarTreino(treino);

  return {
    destruir() {
      parar();
      desinscreverLeitura();
      pararOc();
      painelMic.destruir();
      mic.parar();
    },
  };
}
