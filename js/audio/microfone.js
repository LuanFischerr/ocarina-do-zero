// Microfone: pede permissão com clareza, lê o áudio e devolve leituras de pitch. Nada é gravado nem enviado.
import { garantirAudio } from './sintese.js';
import { detectarPitch, freqParaNota } from './pitch.js';

/** Estados: 'inativo' | 'pedindo' | 'ativo' | 'negado' | 'sem-dispositivo' | 'sem-suporte' | 'inseguro' | 'erro' */
export function suportaMicrofone() {
  if (!window.isSecureContext) return { ok: false, estado: 'inseguro' };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, estado: 'sem-suporte' };
  return { ok: true };
}

export const MENSAGENS_MIC = {
  inseguro: 'O microfone só funciona em páginas seguras (https ou localhost). Abra o site pelo endereço https do GitHub Pages ou por um servidor local.',
  'sem-suporte': 'Este navegador não permite acessar o microfone.',
  negado: 'O acesso ao microfone foi negado. Para usar o modo escuta, permita o microfone nas configurações do site (ícone de cadeado ou de câmera na barra de endereço) e tente de novo.',
  'sem-dispositivo': 'Não encontrei nenhum microfone neste aparelho.',
  erro: 'Não consegui iniciar o microfone. Verifique se outro aplicativo não está usando e tente de novo.',
};

/**
 * Cria o leitor de microfone.
 * aoLeitura({ t, freq, clareza, rms, midiFloat?, midi?, cents?, id? }) é chamado ~33x/s. t = relógio do áudio (s).
 */
export function criarMicrofone({ a4 = 440, intervaloMs = 30 } = {}) {
  let estado = 'inativo';
  let stream = null;
  let fonte = null;
  let analisador = null;
  let timer = null;
  let buf = null;
  const ouvintes = new Set();
  const ouvintesEstado = new Set();

  const definirEstado = (e) => { estado = e; ouvintesEstado.forEach((f) => f(e)); };

  async function iniciar() {
    const s = suportaMicrofone();
    if (!s.ok) { definirEstado(s.estado); return false; }
    if (estado === 'ativo') return true;
    definirEstado('pedindo');
    try {
      const ac = garantirAudio(); // dentro do gesto do usuário
      // sem cancelamento de eco/ruído/ganho automático: eles atrapalham a medição de altura
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      fonte = ac.createMediaStreamSource(stream);
      analisador = ac.createAnalyser();
      analisador.fftSize = 2048;
      analisador.smoothingTimeConstant = 0;
      fonte.connect(analisador); // não conecta ao destino: não há retorno de som
      buf = new Float32Array(analisador.fftSize);
      timer = setInterval(() => {
        analisador.getFloatTimeDomainData(buf);
        const r = detectarPitch(buf, ac.sampleRate);
        const leitura = { t: ac.currentTime, freq: r.freq, clareza: r.clareza, rms: r.rms };
        if (r.freq) Object.assign(leitura, freqParaNota(r.freq, a4));
        ouvintes.forEach((f) => f(leitura));
      }, intervaloMs);
      definirEstado('ativo');
      return true;
    } catch (e) {
      const nome = e?.name;
      definirEstado(nome === 'NotAllowedError' || nome === 'SecurityError' ? 'negado'
        : nome === 'NotFoundError' || nome === 'OverconstrainedError' ? 'sem-dispositivo' : 'erro');
      return false;
    }
  }

  function parar() {
    clearInterval(timer);
    timer = null;
    try { fonte?.disconnect(); } catch { /* ok */ }
    stream?.getTracks().forEach((t) => t.stop());
    stream = null; fonte = null; analisador = null;
    if (estado === 'ativo' || estado === 'pedindo') definirEstado('inativo');
  }

  return {
    iniciar,
    parar,
    get estado() { return estado; },
    aoLeitura(f) { ouvintes.add(f); return () => ouvintes.delete(f); },
    aoEstado(f) { ouvintesEstado.add(f); return () => ouvintesEstado.delete(f); },
  };
}
