// Módulo "Repertório": lista de canções (#/repertorio) e cada canção (#/repertorio/<id>).
// Só notas sintetizadas e arte original; as sequências vêm de data/musicas.json (campo "verificada").
import { obterOcarina, nomeNota, rotuloCompleto, descreverDedilhado } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { montarGuiado, montarEventos } from '../pratica/guiado.js';
import { tocarNota, tocarSequencia, garantirAudio } from '../audio/sintese.js';
import { progressoMusicas, registrarMusica } from '../progresso.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NIVEIS = {
  1: { titulo: 'Nível 1 · comece por aqui', texto: 'Só 3 notas diferentes, sem saltos de oitava.' },
  2: { titulo: 'Nível 2 · intermediário', texto: 'Inclui o Ré 6 (polegar levantado) ou frases com mais notas.' },
  3: { titulo: 'Nível 3 · desafio', texto: 'Saltos de oitava, frases longas ou trocas rápidas de vários dedos.' },
};

let cache = null;
export function obterMusicas() {
  cache ??= fetch(new URL('../../data/musicas.json', import.meta.url))
    .then((r) => { if (!r.ok) throw new Error(`Não consegui carregar musicas.json (${r.status})`); return r.json(); })
    .catch((e) => { cache = null; throw e; });
  return cache;
}

export async function montar(raiz, params = []) {
  raiz.innerHTML = '<p role="status">Carregando o repertório…</p>';
  let O, dados;
  try {
    [O, dados] = await Promise.all([obterOcarina(), obterMusicas()]);
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar o repertório (${esc(e.message)}). Se abriu por file://, use um servidor local — veja o README.</div>`;
    return;
  }
  const ordenadas = dados.musicas.slice().sort((a, b) => a.nivel - b.nivel);
  const idx = ordenadas.findIndex((m) => m.id === params[0]);
  return idx >= 0 ? montarMusica(raiz, { O, dados, ordenadas, idx }) : montarLista(raiz, { O, dados, ordenadas });
}

// ------------------------------------------------------------------ lista
function selo(m) {
  return m.verificada
    ? '<span class="selo selo-alta" title="Sequência conferida em mais de uma fonte">✓ verificada</span>'
    : '<span class="selo selo-media" title="Sequência ainda não conferida: valide com a sua ocarina">não verificada</span>';
}

function montarLista(raiz, { dados, ordenadas }) {
  const prog = progressoMusicas();
  const dominadas = ordenadas.filter((m) => prog[m.id]?.dominada).length;
  const porNivel = [1, 2, 3].map((n) => [n, ordenadas.filter((m) => m.nivel === n)]).filter(([, l]) => l.length);
  raiz.innerHTML = `
    <section>
      <div class="tela-cab">
        <h1>Repertório: Ocarina of Time</h1>
        <p>As 12 canções que Link toca no jogo, da mais fácil para a mais difícil. Cada uma mostra os dedilhados, toca a referência sintetizada e tem o modo guiado com avaliação.</p>
      </div>
      <p class="filtro-status" role="status">${dominadas} de ${ordenadas.length} canções dominadas <small>(85% de acertos em andamento normal)</small></p>
      ${porNivel.map(([n, lista]) => `
        <h2 class="rep-nivel">${NIVEIS[n].titulo}</h2>
        <p class="w-dica">${NIVEIS[n].texto}</p>
        <ul class="rep-lista">
          ${lista.map((m) => {
            const p = prog[m.id];
            return `<li class="cartao rep-card" data-dominada="${!!p?.dominada}">
              <div class="rep-cab"><h3><a href="#/repertorio/${m.id}">${esc(m.titulo)}</a></h3>${selo(m)}</div>
              <p class="rep-orig">${esc(m.titulo_original)}</p>
              <p class="rep-botoes" aria-label="Botões no jogo">${m.botoes_jogo.map((b) => `<span class="tecla-jogo">${esc(b)}</span>`).join('')}</p>
              <p class="w-dica">${m.sequencia.length} notas · ${p ? (p.dominada ? '✓ Dominada' : `melhor: ${p.melhorOk}/${p.melhorTotal} (${p.melhorPct}%)`) : 'ainda não tocada'}</p>
              <a class="btn ${p ? '' : 'btn-primario'}" href="#/repertorio/${m.id}" aria-label="Abrir ${esc(m.titulo)}">${p ? 'Abrir' : 'Aprender'}</a>
            </li>`;
          }).join('')}
        </ul>`).join('')}
      <div class="aviso" style="margin-top: var(--esp-5)">
        <b>Sobre estas canções.</b> As melodias e os nomes pertencem à Nintendo e a Koji Kondo. Este app usa só as sequências curtas de notas, para estudo, com sons sintetizados no seu navegador e arte original. Nenhum áudio ou imagem oficial é usado.
        ${dados.divergencias?.length ? `<br><b>Divergência entre fontes:</b> ${dados.divergencias.map(esc).join(' ')}` : ''}
        <br>O <b>ritmo</b> mostrado é simplificado para estudo: no jogo as canções são definidas só pelas notas.
      </div>
    </section>`;
}

// ------------------------------------------------------------------ canção
/** Trocas que mudam muitos furos de uma vez: as mais difíceis de coordenar. */
function trocasDificeis(O, notas) {
  const vistos = new Set();
  const lista = [];
  for (let i = 1; i < notas.length; i++) {
    const [a, b] = [notas[i - 1], notas[i]];
    if (a === b) continue;
    const chave = `${a}>${b}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const A = new Set(O.porId.get(a).cobertos);
    const B = new Set(O.porId.get(b).cobertos);
    const mudam = [...A].filter((x) => !B.has(x)).length + [...B].filter((x) => !A.has(x)).length;
    lista.push({ de: a, para: b, mudam });
  }
  return lista.filter((t) => t.mudam >= 4).sort((x, y) => y.mudam - x.mudam).slice(0, 4);
}

function montarMusica(raiz, { O, dados, ordenadas, idx }) {
  const m = ordenadas[idx];
  const anterior = ordenadas[idx - 1];
  const proxima = ordenadas[idx + 1];
  const prog = progressoMusicas()[m.id];
  const distintas = [...new Set(m.sequencia)];
  const dificeis = trocasDificeis(O, m.sequencia);
  let cancelaSom = null;
  let timers = [];
  let destruirGuiado = null;

  raiz.innerHTML = `
    <article class="licao repertorio">
      <p class="migalha"><a href="#/repertorio">← Repertório</a> · ${NIVEIS[m.nivel].titulo.split(' · ')[0]}</p>
      <h1>${esc(m.titulo)} <small class="rep-orig-h">${esc(m.titulo_original)}</small></h1>
      <p class="licao-resumo">${esc(m.uso_no_jogo)} ${selo(m)}</p>

      <section class="cartao rep-bloco" aria-labelledby="rb-jogo">
        <h2 id="rb-jogo">No controle do jogo</h2>
        <p class="rep-botoes" aria-label="Botões no jogo">${m.botoes_jogo.map((b) => `<span class="tecla-jogo">${esc(b)}</span>`).join('<span class="seta" aria-hidden="true">›</span>')}</p>
        <p class="w-dica">A = Ré · C▼ = Fá · C▶ = Lá · C◀ = Si · C▲ = Ré agudo. Na ocarina real, você toca as mesmas notas.</p>
      </section>

      <section class="cartao rep-bloco" aria-labelledby="rb-notas">
        <h2 id="rb-notas">Notas e dedilhados</h2>
        <p class="w-dica">Toque em uma nota para ouvir. São ${m.sequencia.length} notas, com ${distintas.length} dedilhados diferentes.</p>
        <ol class="rep-notas" aria-label="Sequência de notas"></ol>
        ${dificeis.length ? `<div class="destaque"><b>Trocas mais difíceis:</b> ${dificeis.map((t) => `${rotuloCompleto(t.de)} → ${rotuloCompleto(t.para)} (${t.mudam} furos mudam juntos)`).join('; ')}. Treine só essa troca, bem devagar, levantando e abaixando os dedos ao mesmo tempo.</div>` : ''}
      </section>

      <section class="cartao rep-bloco" aria-labelledby="rb-ouvir">
        <h2 id="rb-ouvir">Ouvir a referência</h2>
        <div class="w-linha">
          <label class="w-inline">Andamento
            <select data-tempo aria-label="Andamento da referência">
              <option value="50">Lento (50%)</option><option value="75">Médio (75%)</option><option value="100" selected>Normal (100%)</option>
            </select>
          </label>
          <button type="button" class="btn btn-primario" data-ouvir>▶ Ouvir a canção</button>
          <button type="button" class="btn" data-parar-ouvir hidden>■ Parar</button>
        </div>
        <p class="w-dica">Som sintetizado pelo app. ${esc(m.observacao_ritmo)}</p>
      </section>

      <section class="rep-bloco" aria-labelledby="rb-guiado">
        <h2 id="rb-guiado">Tocar com avaliação</h2>
        <div id="rep-guiado"></div>
      </section>

      <section class="cartao rep-bloco" aria-labelledby="rb-plano">
        <h2 id="rb-plano">Como estudar esta canção</h2>
        <ol>
          <li>Passe pelos <b>dedilhados</b> acima e treine cada troca sem soprar.</li>
          <li>Ouça a referência em <b>Lento</b>.</li>
          <li>Toque no modo guiado a <b>50%</b> até acertar tudo.</li>
          <li>Suba para <b>75%</b> e depois <b>100%</b>. Com 85% de acertos a 90% ou mais do andamento, a canção fica marcada como dominada.</li>
        </ol>
        ${prog ? `<p class="w-dica">Seu melhor: ${prog.melhorOk}/${prog.melhorTotal} (${prog.melhorPct}%) a ${prog.melhorAndamento}% do andamento · ${prog.tentativas} tentativa${prog.tentativas > 1 ? 's' : ''}${prog.dominada ? ' · ✓ dominada' : ''}.</p>` : ''}
      </section>

      <section class="cartao rep-bloco" aria-labelledby="rb-fontes">
        <h2 id="rb-fontes">Conferência das notas</h2>
        <p>${m.verificada ? '✓ Sequência <b>verificada</b>' : 'Sequência <b>não verificada</b>'} em ${m.fontes.length} fontes:</p>
        <ul>${m.fontes.map((k) => `<li><a href="${esc(dados.fontes[k].url)}" target="_blank" rel="noopener noreferrer">${esc(dados.fontes[k].titulo)}</a> <small>— ${esc(dados.fontes[k].usado_para)}</small></li>`).join('')}</ul>
        ${m.divergencia ? `<p class="aviso"><b>Divergência entre fontes:</b> ${esc(m.divergencia)}</p>` : ''}
        <p class="aviso">Confira com a sua ocarina: o Ré 6 depende de qual polegar levanta primeiro na sua ocarina (veja as dúvidas na Tabela). Se alguma nota soar errada, ajuste em <code>data/musicas.json</code>.</p>
      </section>

      <nav class="licao-nav" aria-label="Navegar entre canções">
        ${anterior ? `<a class="btn" href="#/repertorio/${anterior.id}">← ${esc(anterior.titulo)}</a>` : '<span></span>'}
        ${proxima ? `<a class="btn" href="#/repertorio/${proxima.id}">${esc(proxima.titulo)} →</a>` : ''}
      </nav>
    </article>`;

  // cartões de nota com mini-ocarina (dedilhado destacado)
  const lista = raiz.querySelector('.rep-notas');
  const cartoes = m.sequencia.map((id, i) => {
    const n = O.porId.get(id);
    const d = descreverDedilhado(O.layout, n.cobertos);
    const li = document.createElement('li');
    li.className = 'rep-nota';
    li.innerHTML = `<button type="button" class="rep-nota-btn" aria-label="Ouvir ${rotuloCompleto(id)}, nota ${i + 1} de ${m.sequencia.length}. Mão esquerda: ${d.esquerda}. Mão direita: ${d.direita}.">
      <span class="rep-ordem" aria-hidden="true">${i + 1}</span>
      <span class="rep-mini"></span>
      <b>${nomeNota(id).pt}</b><small>${nomeNota(id).letra}</small></button>`;
    const mini = criarOcarinaSVG(O.layout, { miniatura: true, descricao: `Dedilhado de ${rotuloCompleto(id)}` });
    mini.definirCobertos(n.cobertos);
    li.querySelector('.rep-mini').append(mini.svg);
    li.querySelector('button').addEventListener('click', () => { pararReferencia(); garantirAudio(); tocarNota(n.midi, { duracao: 1.2 }); marcar(i); setTimeout(() => marcar(-1), 900); });
    lista.append(li);
    return li;
  });
  const marcar = (i) => cartoes.forEach((c, k) => c.classList.toggle('tocando', k === i));

  // referência sintetizada (com destaque da nota que toca)
  const btnOuvir = raiz.querySelector('[data-ouvir]');
  const btnParar = raiz.querySelector('[data-parar-ouvir]');
  const selTempo = raiz.querySelector('[data-tempo]');
  function pararReferencia() {
    cancelaSom?.(); cancelaSom = null;
    timers.forEach(clearTimeout); timers = [];
    marcar(-1);
    btnOuvir.hidden = false; btnParar.hidden = true;
  }
  btnOuvir.addEventListener('click', () => {
    pararReferencia();
    garantirAudio();
    const beat = 60 / ((m.bpm * +selTempo.value) / 100);
    const eventos = montarEventos(O, m.notas);
    cancelaSom = tocarSequencia(eventos.filter((e) => e.midi).map((e) => ({ midi: e.midi, inicio: e.t0 * beat, duracao: e.dur * beat * 0.92 })));
    let ordem = 0;
    for (const e of eventos.filter((x) => x.midi)) {
      const k = ordem++;
      timers.push(setTimeout(() => marcar(k), 60 + e.t0 * beat * 1000));
    }
    const fim = eventos.at(-1).t0 + eventos.at(-1).dur;
    timers.push(setTimeout(pararReferencia, fim * beat * 1000 + 300));
    btnOuvir.hidden = true; btnParar.hidden = false;
  });
  btnParar.addEventListener('click', pararReferencia);

  // modo guiado embutido, com esta música como único exercício
  const treino = { id: m.id, titulo: m.titulo, bpm: m.bpm, nivel: m.nivel, foco: `${m.titulo_original}: ${m.sequencia.length} notas.`, notas: m.notas };
  const g = montarGuiado(raiz.querySelector('#rep-guiado'), {
    O, treinos: [treino], treinoId: m.id, mostrarSeletor: false,
    aoResultado: (r) => registrarMusica(m.id, r),
  });
  destruirGuiado = g.destruir;

  return () => { pararReferencia(); destruirGuiado?.(); };
}
