// Módulo "Prática": quiz (#/pratica/quiz), modo escuta (#/pratica/escuta) e modo guiado (#/pratica/guiado/<treino>).
import { obterOcarina, rotuloCompleto } from '../ocarina/dedilhados.js';
import { montarQuiz, MODOS_QUIZ } from '../pratica/quiz.js';
import { montarEscuta } from '../pratica/escuta.js';
import { montarGuiado } from '../pratica/guiado.js';
import { estatisticasNotas } from '../progresso.js';
import { ler, salvar } from '../estado.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cacheTreinos = null;
export function obterTreinos() {
  cacheTreinos ??= fetch(new URL('../../data/treinos.json', import.meta.url))
    .then((r) => { if (!r.ok) throw new Error(`Não consegui carregar treinos.json (${r.status})`); return r.json(); })
    .then((d) => d.treinos)
    .catch((e) => { cacheTreinos = null; throw e; });
  return cacheTreinos;
}

const ABAS = [
  ['quiz', 'Quiz', 'Qual nota é essa?'],
  ['escuta', 'Modo escuta', 'Diz a nota e se está afinado'],
  ['guiado', 'Modo guiado', 'Notas em sequência, com avaliação'],
];

export async function montar(raiz, params = []) {
  raiz.innerHTML = '<p role="status">Carregando a prática…</p>';
  let O, treinos;
  try {
    [O, treinos] = await Promise.all([obterOcarina(), obterTreinos()]);
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar a prática (${esc(e.message)}). Se abriu por file://, use um servidor local — veja o README.</div>`;
    return;
  }
  const sub = ABAS.some(([k]) => k === params[0]) ? params[0] : null;
  if (!sub) return montarHub(raiz, O);

  raiz.innerHTML = `
    <section class="pratica">
      <p class="migalha"><a href="#/pratica">← Prática</a></p>
      <nav class="subnav" aria-label="Modos de prática">
        ${ABAS.map(([k, t]) => `<a href="#/pratica/${k}" ${k === sub ? 'aria-current="page"' : ''}>${t}</a>`).join('')}
      </nav>
      <div id="pratica-corpo"></div>
    </section>`;
  const corpo = raiz.querySelector('#pratica-corpo');

  if (sub === 'quiz') return montarTelaQuiz(corpo, O);
  if (sub === 'escuta') {
    corpo.innerHTML = '<div class="tela-cab"><h1>Modo escuta</h1><p>Toque a ocarina e veja qual nota você está fazendo e se ela está afinada.</p></div><div id="esc-slot"></div>';
    const s = montarEscuta(corpo.querySelector('#esc-slot'), { O });
    return () => s.destruir();
  }
  corpo.innerHTML = '<div class="tela-cab"><h1>Modo guiado</h1><p>As notas correm até a linha “agora”; o dedilhado aparece na ocarina e o microfone confere se você tocou a nota certa.</p></div><div id="g-slot"></div>';
  const g = montarGuiado(corpo.querySelector('#g-slot'), { O, treinos, treinoId: params[1] ?? ler('guiado.treino', null) });
  corpo.querySelector('[data-treino]')?.addEventListener('change', (e) => salvar('guiado.treino', e.target.value));
  return () => g.destruir();
}

// ------------------------------------------------------------------ hub
function montarHub(raiz, O) {
  const est = estatisticasNotas();
  const vistas = Object.keys(est).length;
  const revisar = Object.entries(est)
    .filter(([, n]) => new Date(n.revisar) <= new Date() && n.erros > 0)
    .sort(([, a], [, b]) => b.erros - a.erros)
    .slice(0, 5)
    .map(([id]) => rotuloCompleto(id));
  raiz.innerHTML = `
    <section>
      <div class="tela-cab">
        <h1>Prática com feedback</h1>
        <p>Três jeitos de treinar: um quiz para fixar dedilhados, um modo escuta que ouve a sua ocarina e um modo guiado com notas em sequência. O microfone é opcional e nunca grava.</p>
      </div>
      <ul class="pratica-cards">
        ${ABAS.map(([k, t, d]) => `<li class="cartao"><h2><a href="#/pratica/${k}">${t}</a></h2><p>${d}</p><a class="btn ${k === 'quiz' ? 'btn-primario' : ''}" href="#/pratica/${k}">Abrir</a></li>`).join('')}
      </ul>
      <div class="cartao" style="margin-top: var(--esp-4)">
        <h2 style="margin-top:0">Para revisar</h2>
        ${revisar.length
          ? `<p>Notas que você errou e já estão na hora de rever: <b>${revisar.join(', ')}</b>.</p><a class="btn" href="#/pratica/quiz">Revisar no quiz</a>`
          : `<p class="w-dica">${vistas ? 'Nenhuma nota pendente de revisão agora. Bom trabalho!' : 'Faça um quiz para o app aprender quais notas pedem mais atenção. Ele sorteia mais as que você erra.'}</p>`}
      </div>
    </section>`;
}

// ------------------------------------------------------------------ quiz
function montarTelaQuiz(corpo, O) {
  let modo = ler('quiz.modo', 'dedilhado-nota');
  let pool = ler('quiz.pool', 'naturais');
  if (!MODOS_QUIZ[modo]) modo = 'dedilhado-nota';
  corpo.innerHTML = `
    <div class="tela-cab"><h1>Qual nota é essa?</h1><p>10 perguntas por rodada. O app sorteia mais as notas que você mais erra.</p></div>
    <div class="cartao q-controles">
      <div class="w-linha" role="group" aria-label="Tipo de pergunta">
        ${Object.entries(MODOS_QUIZ).map(([k, m]) => `<button type="button" class="chip" data-modo="${k}" aria-pressed="${k === modo}">${m.titulo}</button>`).join('')}
      </div>
      <div class="w-linha" role="group" aria-label="Quais notas">
        <button type="button" class="chip" data-pool="naturais" aria-pressed="${pool === 'naturais'}">Só naturais (13)</button>
        <button type="button" class="chip" data-pool="todas" aria-pressed="${pool === 'todas'}">Todas (21, com ♯/♭)</button>
      </div>
    </div>
    <div class="cartao q-corpo"></div>`;
  const slot = corpo.querySelector('.q-corpo');
  let quiz = null;
  function iniciar() {
    quiz?.destruir?.();
    quiz = montarQuiz({ O, modo, pool });
    slot.replaceChildren(quiz.el);
    corpo.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
    corpo.querySelectorAll('[data-pool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pool === pool)));
  }
  corpo.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { modo = b.dataset.modo; salvar('quiz.modo', modo); iniciar(); }));
  corpo.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => { pool = b.dataset.pool; salvar('quiz.pool', pool); iniciar(); }));
  iniciar();
  return () => quiz?.destruir?.();
}
