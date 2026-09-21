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
export function agendarNota(freq, t0, duracao = 1, { pico = 0.5 } = {}) {
  const ac = garantirAudio();
  if (!ac) return null;
  const saida = ac.createGain();
  saida.gain.setValueAtTime(0.0001, t0);
  saida.gain.exponentialRampToValueAtTime(pico, t0 + 0.06);          // ataque suave (sopro entrando)
  saida.gain.setTargetAtTime(pico * 0.8, t0 + 0.08, 0.15);            // assenta
  saida.gain.setTargetAtTime(0.0001, t0 + duracao, 0.08);             // solta
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
 * Toca uma sequência [{ midi, inicio, duracao }] (segundos a partir de agora).
 * Retorna uma função que cancela o que ainda não tocou.
 */
export function tocarSequencia(itens, { a4 = 440 } = {}) {
  const ac = garantirAudio();
  if (!ac) return () => {};
  pararNota(0.04);
  const t0 = ac.currentTime + 0.05;
  const vozes = itens.map(i => agendarNota(frequenciaMidi(i.midi, a4), t0 + i.inicio, i.duracao));
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
