// Síntese de notas com Web Audio API. Timbre "de ocarina": quase senoide pura, ataque suave.
let ctx = null;
let mestre = null;
let notaAtual = null;
let volume = 0.6;

/** Cria/retoma o AudioContext. Precisa ser chamado dentro de um gesto do usuário (toque/clique). */
export function garantirAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    mestre = ctx.createGain();
    mestre.gain.value = volume;
    mestre.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Contexto de áudio compartilhado (o microfone se conecta a ele). Só existe depois de um gesto do usuário. */
export function contextoAudio() {
  return ctx;
}

export function definirVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  if (mestre) mestre.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

export function frequenciaMidi(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Relógio do áudio (segundos) e latência de saída estimada — usados pelo metrônomo e pelo teste de ritmo. */
export function relogio() {
  const ac = garantirAudio();
  return ac ? ac.currentTime : 0;
}
export function latenciaSaida() {
  return ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0;
}

/**
 * Agenda uma nota (voz completa: fundamental + harmônicos leves + vibrato mínimo).
 * Não interrompe outras notas. Retorna { saida, osc } para poder cortar.
 */
export function agendarNota(freq, t0, duracao = 1, { pico = 0.5, ataque = 0.06, soltar = 0.08 } = {}) {
  const ac = garantirAudio();
  if (!ac) return null;
  const saida = ac.createGain();
  saida.gain.setValueAtTime(0.0001, t0);
  saida.gain.exponentialRampToValueAtTime(pico, t0 + ataque);        // ataque (suave = sopro entrando; curto = língua "tu")
  saida.gain.setTargetAtTime(pico * 0.8, t0 + ataque + 0.02, 0.15);   // assenta
  saida.gain.setTargetAtTime(0.0001, t0 + duracao, soltar);          // solta
  saida.connect(mestre);

  const osc = [];
  for (const [mult, ganho] of [[1, 1], [2, 0.07], [3, 0.02]]) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    g.gain.value = ganho;
    o.connect(g).connect(saida);
    o.start(t0);
    o.stop(t0 + duracao + 0.6);
    osc.push(o);
  }
  // vibrato quase imperceptível, para não soar "de máquina"
  const lfo = ac.createOscillator();
  const lfoG = ac.createGain();
  lfo.frequency.value = 4.6;
  lfoG.gain.value = freq * 0.0025;
  lfo.connect(lfoG);
  osc.forEach(o => lfoG.connect(o.frequency));
  lfo.start(t0);
  lfo.stop(t0 + duracao + 0.6);
  return { saida, osc: [...osc, lfo] };
}

/** Toca uma nota (monofônica: interrompe a anterior). Retorna a frequência tocada. */
export function tocarNota(midi, { duracao = 1.2, a4 = 440 } = {}) {
  const ac = garantirAudio();
  if (!ac) return null;
  pararNota(0.04);
  const f = frequenciaMidi(midi, a4);
  notaAtual = agendarNota(f, ac.currentTime, duracao);
  return f;
}

export function pararNota(fade = 0.08) {
  if (!ctx || !notaAtual) return;
  const { saida, osc } = notaAtual;
  const t = ctx.currentTime;
  saida.gain.cancelScheduledValues(t);
  saida.gain.setTargetAtTime(0.0001, t, fade / 3);
  osc.forEach(o => { try { o.stop(t + fade + 0.05); } catch { /* já parado */ } });
  notaAtual = null;
}

/**
 * Toca uma sequência [{ midi, inicio, duracao, pico?, ataque?, soltar? }] (segundos a partir de agora).
 * Retorna uma função que cancela o que ainda não tocou.
 */
export function tocarSequencia(itens, { a4 = 440 } = {}) {
  const ac = garantirAudio();
  if (!ac) return () => {};
  pararNota(0.04);
  const t0 = ac.currentTime + 0.05;
  const vozes = itens.map(i => agendarNota(frequenciaMidi(i.midi, a4), t0 + i.inicio, i.duracao, { pico: i.pico, ataque: i.ataque, soltar: i.soltar }));
  return () => {
    const t = ac.currentTime;
    for (const v of vozes) {
      if (!v) continue;
      v.saida.gain.cancelScheduledValues(t);
      v.saida.gain.setTargetAtTime(0.0001, t, 0.02);
      v.osc.forEach(o => { try { o.stop(t + 0.1); } catch { /* já parado */ } });
    }
  };
}

/** Tom contínuo para a lição de altura (grave/agudo). */
export function iniciarTom(freq) {
  const ac = garantirAudio();
  if (!ac) return null;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.35, ac.currentTime + 0.05);
  o.connect(g).connect(mestre);
  o.start();
  return {
    mudar(f) { o.frequency.setTargetAtTime(f, ac.currentTime, 0.03); },
    parar() {
      const t = ac.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.03);
      try { o.stop(t + 0.2); } catch { /* já parado */ }
    },
  };
}

/** Clique de metrônomo agendado no tempo t do relógio do áudio. */
export function clique(t, forte = false) {
  const ac = garantirAudio();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'triangle';
  o.frequency.value = forte ? 1500 : 1000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(forte ? 0.7 : 0.45, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(mestre);
  o.start(t);
  o.stop(t + 0.08);
}

/** Desvio de afinação (em cents) ilustrativo para uma pressão de sopro p (0 = fraco, 0,4 = ideal, 1 = forte demais). */
export function centsDaPressao(p) {
  return p < 0.4 ? (p - 0.4) * 90 : (p - 0.4) * 130;
}

/**
 * Simulação ILUSTRATIVA do efeito do sopro numa nota sustentada: sopro fraco = grave, fraco e "aerado";
 * sopro ideal = afinado; sopro forte = agudo e áspero. Os valores em cents são didáticos, não medições.
 * Retorna { definirPressao(p), parar() }.
 */
export function iniciarSopro(midi, { a4 = 440, pressao = 0.4 } = {}) {
  const ac = garantirAudio();
  if (!ac) return null;
  const f0 = frequenciaMidi(midi, a4);
  const saida = ac.createGain();
  saida.gain.setValueAtTime(0.0001, ac.currentTime);
  saida.connect(mestre);

  const fundamental = ac.createOscillator();
  const harmo2 = ac.createOscillator();
  const harmo3 = ac.createOscillator();
  const g1 = ac.createGain();
  const g2 = ac.createGain();
  const g3 = ac.createGain();
  fundamental.type = harmo2.type = harmo3.type = 'sine';
  fundamental.connect(g1).connect(saida);
  harmo2.connect(g2).connect(saida);
  harmo3.connect(g3).connect(saida);

  // ruído de sopro (ar passando sem virar som), filtrado perto da nota
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const dados = buf.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  const ruido = ac.createBufferSource();
  ruido.buffer = buf;
  ruido.loop = true;
  const filtro = ac.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = f0 * 2;
  filtro.Q.value = 0.9;
  const gr = ac.createGain();
  ruido.connect(filtro).connect(gr).connect(saida);

  function aplicar(p, t) {
    const cents = centsDaPressao(p);
    const f = f0 * Math.pow(2, cents / 1200);
    fundamental.frequency.setTargetAtTime(f, t, 0.04);
    harmo2.frequency.setTargetAtTime(f * 2, t, 0.04);
    harmo3.frequency.setTargetAtTime(f * 3, t, 0.04);
    const forte = Math.max(0, (p - 0.65) / 0.35);           // 0..1 acima do ideal: som áspero
    const fraco = Math.max(0, (0.4 - p) / 0.4);              // 0..1 abaixo do ideal: som aerado
    saida.gain.setTargetAtTime(0.12 + 0.3 * Math.min(1, p / 0.4) + 0.06 * forte, t, 0.05);
    g1.gain.setTargetAtTime(1, t, 0.05);
    g2.gain.setTargetAtTime(0.06 + 0.45 * forte, t, 0.05);
    g3.gain.setTargetAtTime(0.02 + 0.3 * forte, t, 0.05);
    gr.gain.setTargetAtTime(0.03 + 0.35 * fraco * fraco + 0.12 * forte, t, 0.05);
  }
  aplicar(pressao, ac.currentTime);
  fundamental.start();
  harmo2.start();
  harmo3.start();
  ruido.start();

  return {
    definirPressao(p) { aplicar(Math.min(1, Math.max(0, p)), ac.currentTime); },
    parar() {
      const t = ac.currentTime;
      saida.gain.cancelScheduledValues(t);
      saida.gain.setTargetAtTime(0.0001, t, 0.04);
      for (const n of [fundamental, harmo2, harmo3, ruido]) { try { n.stop(t + 0.3); } catch { /* já parado */ } }
    },
  };
}
