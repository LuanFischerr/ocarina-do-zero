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

/** Toca uma nota (monofônica: interrompe a anterior). Retorna a frequência tocada. */
export function tocarNota(midi, { duracao = 1.2, a4 = 440 } = {}) {
  const ac = garantirAudio();
  if (!ac) return null;
  pararNota(0.04);

  const f = frequenciaMidi(midi, a4);
  const t0 = ac.currentTime;
  const saida = ac.createGain();
  saida.gain.setValueAtTime(0.0001, t0);
  saida.gain.exponentialRampToValueAtTime(0.5, t0 + 0.06);          // ataque suave (sopro entrando)
  saida.gain.setTargetAtTime(0.4, t0 + 0.08, 0.15);                  // assenta
  saida.gain.setTargetAtTime(0.0001, t0 + duracao, 0.08);            // solta
  saida.connect(mestre);

  const osc = [];
  for (const [mult, ganho] of [[1, 1], [2, 0.07], [3, 0.02]]) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = f * mult;
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
  lfoG.gain.value = f * 0.0025;
  lfo.connect(lfoG);
  osc.forEach(o => lfoG.connect(o.frequency));
  lfo.start(t0);
  lfo.stop(t0 + duracao + 0.6);

  notaAtual = { saida, osc: [...osc, lfo] };
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
