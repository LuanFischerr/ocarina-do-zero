// Mini-exercícios das lições: motor de quiz + geradores + teste de pulso (toque no ritmo).
import { nomeNota } from '../ocarina/dedilhados.js';
import { desenharPauta } from './pauta.js';
import { criarMetronomo } from './ritmo.js';
import { garantirAudio, tocarSequencia, frequenciaMidi, relogio, latenciaSaida } from '../audio/sintese.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sortear = (arr) => arr[Math.floor(Math.random() * arr.length)];
function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const NOMES = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
const LETRAS = Object.keys(NOMES);

// ------------------------------------------------------------------ motor de quiz
/**
 * @param gerar  () => [{ enunciado, extra?, aoMostrar?, opcoes: string[], correta: number, explicacao }]
 * @param aoTerminar ({ acertos, total, aprovada }) => void
 * @param aoResponder (pergunta, certa) => void  — usado pela Prática para registrar acertos por nota
 * @param mensagemFim (acertos, total, aprovada) => string  — texto do resultado (padrão: aprovado/reprovado)
 */
export function criarQuiz({ instrucao, gerar, aprovacao, aoTerminar, aoResponder = null, mensagemFim = null }) {
  const el = html(`<div class="quiz"><p class="quiz-instr">${instrucao}</p><div class="quiz-corpo"></div></div>`);
  const corpo = el.querySelector('.quiz-corpo');
  let perguntas = [];
  let i = 0;
  let acertos = 0;
  let cancelaSom = null;

  function comecar() {
    perguntas = gerar();
    i = 0;
    acertos = 0;
    mostrar();
  }

  function mostrar() {
    cancelaSom?.();
    const p = perguntas[i];
    corpo.innerHTML = `
      <p class="quiz-prog" aria-live="polite">Pergunta ${i + 1} de ${perguntas.length}</p>
      <p class="quiz-enun">${p.enunciado}</p>
      <div class="quiz-extra"></div>
      <div class="quiz-opcoes" role="group" aria-label="Alternativas">
        ${p.opcoes.map((o, k) => `<button type="button" class="quiz-op" data-k="${k}">${o}</button>`).join('')}
      </div>
      <div class="quiz-feedback" role="status" aria-live="polite"></div>`;
    if (p.extra) corpo.querySelector('.quiz-extra').append(p.extra());
    corpo.querySelectorAll('.quiz-op').forEach((b) => b.addEventListener('click', () => responder(Number(b.dataset.k))));
    p.aoMostrar?.();
    corpo.querySelector('.quiz-op')?.focus({ preventScroll: true });
  }

  function responder(k) {
    const p = perguntas[i];
    const certa = k === p.correta;
    if (certa) acertos++;
    aoResponder?.(p, certa);
    corpo.querySelectorAll('.quiz-op').forEach((b) => {
      const n = Number(b.dataset.k);
      b.disabled = true;
      if (n === p.correta) b.classList.add('certa');
      else if (n === k) b.classList.add('errada');
    });
    const ultima = i === perguntas.length - 1;
    const fb = corpo.querySelector('.quiz-feedback');
    fb.innerHTML = `<p class="${certa ? 'ok' : 'erro'}"><b>${certa ? '✓ Certo!' : '✗ Quase.'}</b> ${p.explicacao ?? ''}</p>
      <button type="button" class="btn btn-primario" data-prox>${ultima ? 'Ver resultado' : 'Próxima →'}</button>`;
    const prox = fb.querySelector('[data-prox]');
    prox.addEventListener('click', () => { if (ultima) fim(); else { i++; mostrar(); } });
    prox.focus({ preventScroll: true });
  }

  function fim() {
    const total = perguntas.length;
    const aprovada = acertos >= aprovacao;
    corpo.innerHTML = `
      <div class="quiz-fim" data-ok="${aprovada}">
        <p class="grande">${acertos} de ${total}</p>
        <p>${mensagemFim ? mensagemFim(acertos, total, aprovada) : aprovada ? '✓ Etapa concluída! Muito bem.' : `Você precisa de pelo menos ${aprovacao} acertos. Vale tentar de novo, sem pressa.`}</p>
        <button type="button" class="btn ${aprovada ? '' : 'btn-primario'}" data-de-novo>${aprovada ? 'Refazer' : 'Tentar de novo'}</button>
      </div>`;
    corpo.querySelector('[data-de-novo]').addEventListener('click', comecar);
    aoTerminar({ acertos, total, aprovada });
  }

  comecar();
  return { el, destruir: () => cancelaSom?.(), definirCancela: (f) => { cancelaSom = f; } };
}

// ------------------------------------------------------------------ geradores
function gerarAltura(O, rodadas) {
  return () => {
    const usados = [];
    return Array.from({ length: rodadas }, () => {
      let a, b;
      do {
        a = sortear(O.notas); b = sortear(O.notas);
      } while (Math.abs(a.midi - b.midi) < 4 || usados.includes(`${a.id}${b.id}`));
      usados.push(`${a.id}${b.id}`);
      const tocar = () => tocarSequencia([{ midi: a.midi, inicio: 0, duracao: 0.7 }, { midi: b.midi, inicio: 1, duracao: 0.7 }]);
      return {
        enunciado: 'Qual dos dois sons é o <b>mais agudo</b>?',
        extra: () => {
          const btn = html('<button type="button" class="btn btn-primario">▶ Ouvir os dois sons</button>');
          btn.addEventListener('click', tocar);
          return btn;
        },
        aoMostrar: () => { garantirAudio(); tocar(); },
        opcoes: ['O primeiro', 'O segundo'],
        correta: a.midi > b.midi ? 0 : 1,
        explicacao: `O primeiro era ${frequenciaMidi(a.midi).toFixed(0)} Hz e o segundo ${frequenciaMidi(b.midi).toFixed(0)} Hz. Quanto maior a frequência, mais agudo.`,
      };
    });
  };
}

function gerarNotaLetra(rodadas) {
  return () => {
    const ordem = embaralhar(LETRAS).concat(embaralhar(LETRAS)).slice(0, rodadas);
    return ordem.map((l, i) => {
      const paraLetra = i % 2 === 0;
      const outras = embaralhar(LETRAS.filter((x) => x !== l)).slice(0, 3);
      const alternativas = embaralhar([l, ...outras]);
      return paraLetra
        ? { enunciado: `Qual é a <b>letra</b> da nota <b>${NOMES[l]}</b>?`, opcoes: alternativas, correta: alternativas.indexOf(l), explicacao: `${NOMES[l]} = ${l}.` }
        : { enunciado: `A letra <b>${l}</b> é qual nota?`, opcoes: alternativas.map((x) => NOMES[x]), correta: alternativas.indexOf(l), explicacao: `${l} = ${NOMES[l]}.` };
    });
  };
}

function gerarPauta(O, rodadas) {
  const naturais = O.notas.filter((n) => nomeNota(n.id).natural);
  return () => {
    const ids = embaralhar(naturais).slice(0, rodadas);
    return ids.map((n) => {
      const l = n.id[0];
      const alternativas = embaralhar([l, ...embaralhar(LETRAS.filter((x) => x !== l)).slice(0, 3)]);
      const nm = nomeNota(n.id);
      return {
        enunciado: 'Qual é o <b>nome</b> desta nota?',
        extra: () => desenharPauta(n.id, { descricao: 'Uma nota escrita na pauta' }),
        opcoes: alternativas.map((x) => `${NOMES[x]} (${x})`),
        correta: alternativas.indexOf(l),
        explicacao: `É ${nm.pt} (${nm.letra}). Cada linha ou espaço da pauta é uma nota; suba na pauta e a nota fica mais aguda.`,
      };
    });
  };
}

function gerarEstatico(perguntas) {
  return () => embaralhar(perguntas).map((q) => {
    const ordem = embaralhar(q.opcoes.map((o, k) => ({ o, k })));
    return {
      enunciado: q.texto,
      opcoes: ordem.map((x) => x.o),
      correta: ordem.findIndex((x) => x.k === q.correta),
      explicacao: q.explicacao,
    };
  });
}

// ------------------------------------------------------------------ teste de pulso
function criarRitmoToque({ instrucao, aoTerminar }) {
  const BPM = 60;
  const CONTAGEM = 4;
  const TESTE = 8;
  const seg = 60 / BPM;
  const el = html(`
    <div class="ritmo-toque">
      <p class="quiz-instr">${instrucao}</p>
      <p class="w-dica">Vão ser ${CONTAGEM} batidas de contagem e depois ${TESTE} batidas para você acompanhar, a ${BPM} BPM. Use o botão, a tela ou a barra de espaço.</p>
      <div class="rt-palco" aria-live="polite"><p class="rt-status">Pronto?</p></div>
      <div class="rt-acoes">
        <button type="button" class="btn btn-primario" data-comecar>▶ Começar</button>
        <button type="button" class="rt-tap" data-tap disabled>TOQUE</button>
      </div>
      <div class="rt-resultado"></div>
    </div>`);
  const status = el.querySelector('.rt-status');
  const btnIniciar = el.querySelector('[data-comecar]');
  const btnTap = el.querySelector('[data-tap]');
  const resultado = el.querySelector('.rt-resultado');
  let m = null;
  let taps = [];
  let ativo = false;
  let timers = [];

  function limpar() {
    m?.parar();
    m = null;
    ativo = false;
    timers.forEach(clearTimeout);
    timers = [];
    btnTap.disabled = true;
  }

  function comecar() {
    limpar();
    garantirAudio();
    taps = [];
    resultado.innerHTML = '';
    btnIniciar.disabled = true;
    ativo = true;
    m = criarMetronomo({
      bpm: BPM,
      aoBatida: (i, n) => {
        if (n < CONTAGEM) status.textContent = `Contagem: ${n + 1}`;
        else status.textContent = `Toque! ${n - CONTAGEM + 1} de ${TESTE}`;
        if (n === CONTAGEM) btnTap.disabled = false;
        btnTap.classList.toggle('pulso', n >= CONTAGEM);
      },
    });
    m.iniciar();
    const total = (CONTAGEM + TESTE) * seg + 0.9;
    timers.push(setTimeout(() => finalizar(), total * 1000));
  }

  function tocou() {
    if (!ativo) return;
    taps.push(relogio() - latenciaSaida());
    btnTap.classList.remove('bateu');
    void btnTap.offsetWidth;
    btnTap.classList.add('bateu');
  }

  function finalizar() {
    const batidas = (m?.batidas ?? []).filter((b) => b.n >= CONTAGEM && b.n < CONTAGEM + TESTE);
    limpar();
    btnIniciar.disabled = false;
    btnIniciar.textContent = '↻ Tentar de novo';
    status.textContent = 'Fim!';
    // para cada batida do teste, o toque mais próximo (dentro de meio tempo)
    const desvios = [];
    for (const b of batidas) {
      let melhor = null;
      for (const t of taps) {
        const d = t - b.t;
        if (Math.abs(d) <= seg / 2 && (melhor === null || Math.abs(d) < Math.abs(melhor))) melhor = d;
      }
      if (melhor !== null) desvios.push(melhor * 1000);
    }
    const acertos = desvios.length;
    const media = acertos ? desvios.reduce((s, d) => s + Math.abs(d), 0) / acertos : 0;
    const tendencia = acertos ? desvios.reduce((s, d) => s + d, 0) / acertos : 0;
    const aprovada = acertos >= 6 && media <= 170;
    resultado.innerHTML = `
      <div class="quiz-fim" data-ok="${aprovada}">
        <p class="grande">${acertos} de ${TESTE} batidas</p>
        <p>${acertos ? `Erro médio: <b>${Math.round(media)} ms</b>${Math.abs(tendencia) > 40 ? (tendencia > 0 ? ' — você tende a tocar um pouco <b>depois</b> da batida.' : ' — você tende a tocar um pouco <b>antes</b> da batida.') : ' — bem no tempo!'}` : 'Não detectei toques nas batidas.'}</p>
        <p>${aprovada ? '✓ Etapa concluída! Você segue o pulso.' : 'Precisa de pelo menos 6 batidas com erro médio abaixo de 170 ms. Tente de novo, olhando o metrônomo.'}</p>
      </div>`;
    aoTerminar({ acertos, total: TESTE, aprovada });
  }

  btnIniciar.addEventListener('click', comecar);
  btnTap.addEventListener('pointerdown', (e) => { e.preventDefault(); tocou(); });
  btnTap.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tocou(); } });
  const teclaGlobal = (e) => {
    if (e.code === 'Space' && ativo && document.activeElement !== btnTap) { e.preventDefault(); if (!e.repeat) tocou(); }
  };
  document.addEventListener('keydown', teclaGlobal);

  return { el, destruir: () => { limpar(); document.removeEventListener('keydown', teclaGlobal); } };
}

// ------------------------------------------------------------------ fábrica
/** Monta uma etapa de exercício a partir da definição do JSON. */
export function montarEtapa(def, { O, aoTerminar }) {
  switch (def.tipo) {
    case 'altura':
      return criarQuiz({ instrucao: esc(def.instrucao), gerar: gerarAltura(O, def.rodadas), aprovacao: def.aprovacao, aoTerminar });
    case 'nota-letra':
      return criarQuiz({ instrucao: esc(def.instrucao), gerar: gerarNotaLetra(def.rodadas), aprovacao: def.aprovacao, aoTerminar });
    case 'pauta':
      return criarQuiz({ instrucao: esc(def.instrucao), gerar: gerarPauta(O, def.rodadas), aprovacao: def.aprovacao, aoTerminar });
    case 'quiz':
      return criarQuiz({ instrucao: esc(def.instrucao), gerar: gerarEstatico(def.perguntas), aprovacao: def.aprovacao, aoTerminar });
    case 'ritmo-toque':
      return criarRitmoToque({ instrucao: def.instrucao, aoTerminar });
    default:
      return { el: html(`<p class="aviso">Tipo de exercício desconhecido: ${esc(def.tipo)}</p>`) };
  }
}
