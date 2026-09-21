// Painel de permissão do microfone: explica o que acontece com o áudio, pede só num clique e trata negativas.
import { suportaMicrofone, MENSAGENS_MIC } from '../audio/microfone.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

/**
 * @param mic  resultado de criarMicrofone()
 * @param opcoes { titulo, aoSemMic() } — aoSemMic é chamado quando a pessoa escolhe seguir sem microfone
 */
export function criarPainelMic(mic, { titulo = 'Ouvir a sua ocarina', aoSemMic = null } = {}) {
  const el = html('<div class="cartao painel-mic" aria-live="polite"></div>');
  let seguindoSem = false;

  function desenhar() {
    const e = mic.estado;
    el.dataset.estado = e;
    if (e === 'ativo') {
      el.innerHTML = `<div class="pm-linha"><span class="pm-ponto" aria-hidden="true"></span><b>Microfone ativo</b>
        <span class="w-dica">Analisando em tempo real, sem gravar.</span>
        <button type="button" class="btn" data-desligar>Desativar</button></div>`;
      el.querySelector('[data-desligar]').addEventListener('click', () => mic.parar());
      return;
    }
    if (seguindoSem) {
      el.innerHTML = `<div class="pm-linha"><b>Modo sem microfone</b>
        <span class="w-dica">Você acompanha sozinho, sem avaliação automática.</span>
        <button type="button" class="btn" data-ativar>Tentar usar o microfone</button></div>`;
      el.querySelector('[data-ativar]').addEventListener('click', () => { seguindoSem = false; ativar(); });
      return;
    }
    const problema = !['inativo', 'pedindo'].includes(e);
    const msg = problema ? (MENSAGENS_MIC[e] ?? MENSAGENS_MIC.erro) : '';
    el.innerHTML = `
      <h3>${titulo}</h3>
      <p>Para dizer que nota você está tocando e se está afinado, o app precisa do <b>microfone</b> do seu aparelho.</p>
      <ul class="pm-lista">
        <li>O áudio é analisado <b>aqui no navegador</b>, em tempo real.</li>
        <li><b>Nada é gravado nem enviado</b> para nenhum servidor.</li>
        <li>O navegador vai perguntar se você permite. Você pode recusar e continuar usando o resto.</li>
        <li>Use <b>fones de ouvido</b> quando o app tocar sons, para o som não voltar pelo microfone.</li>
      </ul>
      ${problema ? `<p class="aviso" role="alert">${msg}</p>` : ''}
      <div class="pm-acoes">
        <button type="button" class="btn btn-primario" data-ativar ${e === 'pedindo' ? 'disabled' : ''}>${e === 'pedindo' ? 'Aguardando permissão…' : problema ? 'Tentar de novo' : '🎤 Ativar microfone'}</button>
        ${aoSemMic ? '<button type="button" class="btn" data-sem>Continuar sem microfone</button>' : ''}
      </div>`;
    el.querySelector('[data-ativar]')?.addEventListener('click', ativar);
    el.querySelector('[data-sem]')?.addEventListener('click', () => { seguindoSem = true; desenhar(); aoSemMic(); });
  }

  async function ativar() {
    await mic.iniciar();
    desenhar();
  }

  const parar = mic.aoEstado(() => desenhar());
  desenhar();
  return {
    el,
    /** true se a pessoa escolheu seguir sem microfone */
    get semMic() { return seguindoSem; },
    destruir: parar,
    suportado: suportaMicrofone().ok,
  };
}
