// Modo escuta: mostra a nota que você está tocando e se está afinado.
import { nomeNota, rotuloCompleto } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG, ocarinaResponsiva } from '../ocarina/ocarina-svg.js';
import { criarMedidor, classificarCents } from '../ocarina/medidor.js';
import { criarMicrofone } from '../audio/microfone.js';
import { criarPainelMic } from './painel-mic.js';
import { tocarNota, garantirAudio } from '../audio/sintese.js';
import { midiParaId } from '../audio/pitch.js';
import { registrarUso } from '../progresso.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const mediana = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };

export function montarEscuta(raiz, { O }) {
  const a4 = O.dados.referencia_a4_hz;
  const mic = criarMicrofone({ a4 });
  const painelMic = criarPainelMic(mic, {
    titulo: 'Modo escuta',
    aoSemMic: () => { estadoSemMic(true); },
  });

  const el = html(`
    <div class="escuta">
      <div data-painel-mic></div>
      <div class="esc-corpo" hidden>
        <div class="esc-alvo cartao">
          <label class="w-inline">Nota-alvo
            <select data-alvo aria-label="Nota-alvo">
              <option value="">Qualquer nota (só me diga qual é)</option>
              ${O.notas.map((n) => `<option value="${n.id}">${rotuloCompleto(n.id)} (${nomeNota(n.id).letra})</option>`).join('')}
            </select>
          </label>
          <button type="button" class="btn" data-ouvir-alvo disabled>▶ Ouvir a nota-alvo</button>
        </div>
        <div class="esc-grade">
          <div class="cartao esc-leitura" aria-live="off">
            <p class="esc-nota" aria-hidden="true">—</p>
            <p class="esc-info"><span class="esc-letra"></span> <span class="esc-hz"></span></p>
            <div data-medidor></div>
            <div class="esc-nivel" aria-hidden="true"><span>volume</span><i><b></b></i></div>
            <p class="esc-dica" role="status" aria-live="polite">Sopre a ocarina: vou dizer a nota.</p>
          </div>
          <div class="cartao esc-oc-cartao">
            <div class="esc-oc"></div>
            <p class="w-dica esc-oc-txt"></p>
          </div>
        </div>
        <div class="cartao">
          <h3 class="esc-hist-tit">Estabilidade (últimos segundos)</h3>
          <canvas class="esc-hist" height="90" role="img" aria-label="Gráfico da afinação ao longo do tempo"></canvas>
          <p class="w-dica">A faixa verde é a região afinada. Uma linha reta dentro dela é uma nota firme.</p>
        </div>
      </div>
      <div class="cartao esc-sem" hidden>
        <h3>Sem microfone</h3>
        <p>Você ainda pode treinar de ouvido: escolha uma nota abaixo, ouça a referência e compare com a sua ocarina. Um afinador de celular também ajuda.</p>
        <div class="w-linha"><select data-alvo-sem aria-label="Nota de referência">${O.notas.map((n) => `<option value="${n.id}">${rotuloCompleto(n.id)}</option>`).join('')}</select>
        <button type="button" class="btn btn-primario" data-ouvir-sem>▶ Ouvir referência</button></div>
      </div>
    </div>`);

  el.querySelector('[data-painel-mic]').append(painelMic.el);
  const corpo = el.querySelector('.esc-corpo');
  const semBox = el.querySelector('.esc-sem');
  const notaEl = el.querySelector('.esc-nota');
  const letraEl = el.querySelector('.esc-letra');
  const hzEl = el.querySelector('.esc-hz');
  const dicaEl = el.querySelector('.esc-dica');
  const nivelEl = el.querySelector('.esc-nivel b');
  const ocTxt = el.querySelector('.esc-oc-txt');
  const alvoSel = el.querySelector('[data-alvo]');
  const btnAlvo = el.querySelector('[data-ouvir-alvo]');
  const canvas = el.querySelector('.esc-hist');
  const medidor = criarMedidor();
  el.querySelector('[data-medidor]').append(medidor.el);

  // ocarina (mini) que mostra o dedilhado da nota detectada/alvo
  let ultimoDedilhado = [];
  let ocarina = null;
  const pararOc = ocarinaResponsiva(el.querySelector('.esc-oc'), O.layout, { descricao: 'Dedilhado da nota' }, (oc) => {
    ocarina = oc;
    oc.mostrarRotulos(true);
    oc.definirCobertos(ultimoDedilhado);
  }, { limite: 460 });

  const recentes = [];           // últimas leituras válidas (para mediana)
  const historico = [];          // { t, cents|null } para o gráfico
  let ultimaValida = 0;
  let mudoAte = 0;               // silencia a análise enquanto o app toca a referência
  let idExibido = null;
  let contouUso = false;

  const alvo = () => (alvoSel.value ? O.porId.get(alvoSel.value) : null);

  function atualizarAlvo() {
    btnAlvo.disabled = !alvoSel.value;
    if (alvoSel.value) mostrarDedilhado(alvoSel.value, 'Dedilhado da nota-alvo');
  }
  function mostrarDedilhado(id, legenda) {
    const n = O.porId.get(id);
    ultimoDedilhado = n ? n.cobertos : [];
    ocarina?.definirCobertos(ultimoDedilhado, { destacarMudancas: true });
    ocTxt.textContent = n ? `${legenda}: ${rotuloCompleto(id)}` : `${id}: fora da extensão da sua ocarina (Lá 4 a Fá 6)`;
  }
  alvoSel.addEventListener('change', atualizarAlvo);
  btnAlvo.addEventListener('click', () => {
    garantirAudio();
    mudoAte = performance.now() + 1800;
    tocarNota(alvo().midi, { duracao: 1.4, a4 });
  });

  function aoLeitura(l) {
    const agora = performance.now();
    if (agora < mudoAte) return;
    nivelEl.style.width = `${Math.min(100, Math.max(0, (Math.log10(Math.max(l.rms, 1e-4)) + 4) / 3 * 100))}%`;

    if (l.freq) { recentes.push(l); ultimaValida = agora; }
    else recentes.push(null);
    if (recentes.length > 6) recentes.shift();
    const validas = recentes.filter(Boolean);
    const estavel = validas.length >= 3;

    const alvoNota = alvo();
    if (estavel) {
      if (!contouUso) { contouUso = true; registrarUso('escuta'); }
      const midiF = mediana(validas.map((v) => v.midiFloat));
      const freq = mediana(validas.map((v) => v.freq));
      const midi = Math.round(midiF);
      const id = midiParaId(midi);
      const ref = alvoNota ? alvoNota.midi : midi;
      const cents = (midiF - ref) * 100;
      const cls = medidor.definir(Math.max(-60, Math.min(60, cents)));
      notaEl.textContent = nomeNota(id).pt;
      letraEl.textContent = `${nomeNota(id).letra}${nomeNota(id).enarmonica ? ' / ' + nomeNota(id).enarmonica.letra : ''}`;
      hzEl.textContent = `· ${freq.toFixed(1)} Hz`;
      if (id !== idExibido) { idExibido = id; if (!alvoNota) mostrarDedilhado(id, 'Dedilhado'); }
      dicaEl.textContent = dica(cls, alvoNota, id, cents);
      historico.push({ t: agora, cents: Math.max(-60, Math.min(60, cents)) });
    } else if (agora - ultimaValida > 450) {
      medidor.definir(null);
      notaEl.textContent = '—';
      letraEl.textContent = '';
      hzEl.textContent = '';
      dicaEl.textContent = 'Sopre a ocarina: vou dizer a nota.';
      idExibido = null;
      historico.push({ t: agora, cents: null });
    }
    desenharHistorico();
  }

  function dica(cls, alvoNota, id, cents) {
    if (alvoNota && Math.round(cents / 100) !== 0 && Math.abs(cents) > 60) {
      return `Você está tocando ${rotuloCompleto(id)}, mas o alvo é ${rotuloCompleto(alvoNota.id)}. Confira o dedilhado.`;
    }
    switch (cls.id) {
      case 'afinado': return 'Afinado! Mantenha o sopro suave e constante.';
      case 'pouco-agudo': return 'Um pouco agudo: alivie o sopro.';
      case 'muito-agudo': return 'Muito agudo: sopro forte demais, ou dedilhado de outra nota. Sopre mais suave.';
      case 'pouco-grave': return 'Um pouco grave: dê um pouco mais de ar, sem forçar.';
      case 'muito-grave': return 'Muito grave: sopro fraco, ou um furo vazando. Confira a cobertura dos dedos.';
      default: return '';
    }
  }

  function desenharHistorico() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = 90;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const y = (c) => h / 2 - (c / 60) * (h / 2 - 4);
    g.fillStyle = css.getPropertyValue('--verde-suave').trim() || '#d5ecdc';
    g.fillRect(0, y(12), w, y(-12) - y(12));
    g.strokeStyle = css.getPropertyValue('--borda-forte').trim() || '#888';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y(0)); g.lineTo(w, y(0)); g.stroke();
    const agora = performance.now();
    const janela = 6000;
    while (historico.length && agora - historico[0].t > janela) historico.shift();
    g.strokeStyle = css.getPropertyValue('--azul-2').trim() || '#3b52c9';
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.beginPath();
    let aberto = false;
    for (const p of historico) {
      if (p.cents == null) { aberto = false; continue; }
      const x = w - ((agora - p.t) / janela) * w;
      if (!aberto) { g.moveTo(x, y(p.cents)); aberto = true; } else g.lineTo(x, y(p.cents));
    }
    g.stroke();
  }

  function estadoSemMic(sem) {
    semBox.hidden = !sem;
    corpo.hidden = sem || mic.estado !== 'ativo';
  }
  const desinscreverEstado = mic.aoEstado((e) => {
    corpo.hidden = e !== 'ativo';
    if (e === 'ativo') semBox.hidden = true;
    if (e !== 'ativo') { medidor.definir(null); recentes.length = 0; }
  });
  const desinscreverLeitura = mic.aoLeitura(aoLeitura);
  el.querySelector('[data-ouvir-sem]').addEventListener('click', () => {
    garantirAudio();
    tocarNota(O.porId.get(el.querySelector('[data-alvo-sem]').value).midi, { duracao: 2, a4 });
  });
  window.addEventListener('resize', desenharHistorico);
  atualizarAlvo();

  raiz.append(el);
  return {
    mic,
    destruir() {
      desinscreverEstado(); desinscreverLeitura();
      window.removeEventListener('resize', desenharHistorico);
      pararOc();
      painelMic.destruir();
      mic.parar();
    },
  };
}
