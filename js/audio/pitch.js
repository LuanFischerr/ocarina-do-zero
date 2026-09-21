// Detecção de altura (pitch) por autocorrelação normalizada (estilo McLeod/NSDF) + conversão para nota.
const NOMES_OITAVA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * @param buf  Float32Array com o sinal (janela de ~2048 amostras)
 * @param sr   taxa de amostragem
 * @returns { freq, clareza, rms }  — freq = null quando é silêncio ou não há altura clara
 */
export function detectarPitch(buf, sr, { min = 330, max = 1700, limiarRms = 0.008, limiarClareza = 0.86 } = {}) {
  const N = buf.length;
  let soma = 0;
  for (let i = 0; i < N; i++) soma += buf[i] * buf[i];
  const rms = Math.sqrt(soma / N);
  if (rms < limiarRms) return { freq: null, clareza: 0, rms };

  const tauMin = Math.max(2, Math.floor(sr / max));
  const tauMax = Math.min(Math.floor(sr / min), (N >> 1) - 2);
  const nsdf = new Float32Array(tauMax + 2);
  // NSDF(τ) = 2·Σ x[i]·x[i+τ] / Σ (x[i]² + x[i+τ]²)  → varia de −1 a 1; 1 = periodicidade perfeita
  for (let tau = tauMin - 1; tau <= tauMax + 1; tau++) {
    let acf = 0;
    let energia = 0;
    for (let i = 0; i < N - tau; i++) {
      const a = buf[i];
      const b = buf[i + tau];
      acf += a * b;
      energia += a * a + b * b;
    }
    nsdf[tau] = energia > 0 ? (2 * acf) / energia : 0;
  }

  // picos locais; escolhe o primeiro (menor τ = maior freq.) que chega a 90% do pico máximo, para evitar erro de oitava
  const picos = [];
  let maior = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (nsdf[tau] > 0 && nsdf[tau] >= nsdf[tau - 1] && nsdf[tau] > nsdf[tau + 1]) {
      picos.push(tau);
      if (nsdf[tau] > maior) maior = nsdf[tau];
    }
  }
  if (!picos.length || maior < limiarClareza) return { freq: null, clareza: Math.max(0, maior), rms };
  const escolhido = picos.find((t) => nsdf[t] >= 0.9 * maior);

  // interpolação parabólica para precisão sub-amostra
  const a = nsdf[escolhido - 1];
  const b = nsdf[escolhido];
  const c = nsdf[escolhido + 1];
  const denom = a - 2 * b + c;
  const deslocamento = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const tauFino = escolhido + deslocamento;
  return { freq: sr / tauFino, clareza: b, rms };
}

/** Frequência -> nota (midi contínuo, midi inteiro mais próximo, cents de desvio e id "C#5"). */
export function freqParaNota(freq, a4 = 440) {
  const midiFloat = 12 * Math.log2(freq / a4) + 69;
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  const id = `${NOMES_OITAVA[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  return { midiFloat, midi, cents, id };
}

export function midiParaId(midi) {
  return `${NOMES_OITAVA[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
