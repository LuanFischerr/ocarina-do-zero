// Tabela completa de dedilhados (Alto C, A4–F6), com miniaturas, filtros, som e fontes/divergências.
import { obterOcarina, nomeNota, rotuloCompleto, descreverDedilhado } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { tocarNota, frequenciaMidi, garantirAudio } from '../audio/sintese.js';
import { ler, salvar } from '../estado.js';

const SELOS = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' };
const FILTROS = [
  ['todas', 'Todas', () => true],
  ['naturais', 'Só naturais (Dó Ré Mi…)', (n) => nomeNota(n.id).natural],
  ['acidentes', 'Sustenidos e bemóis', (n) => !nomeNota(n.id).natural],
  ['divergentes', 'Com dúvida', (n) => n.confianca !== 'alta' || !!n.alternativas],
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function montar(raiz) {
  raiz.innerHTML = '<p role="status">Carregando a tabela…</p>';
  let O;
  try {
    O = await obterOcarina();
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar os dados (${esc(e.message)}). Se abriu por file://, use um servidor local — veja o README.</div>`;
    return;
  }
  const { layout, notas, dados } = O;
  const a4 = dados.referencia_a4_hz;
  let filtro = ler('tabela.filtro', 'todas');
  if (!FILTROS.some(([k]) => k === filtro)) filtro = 'todas';

  raiz.innerHTML = `
    <section>
      <div class="tela-cab">
        <h1>Tabela de dedilhados</h1>
        <p>Todas as ${notas.length} notas da sua ocarina Alto C, de ${rotuloCompleto(dados.extensao.grave)} a ${rotuloCompleto(dados.extensao.aguda)}. Círculo preenchido = furo <b>coberto</b>; vazio = <b>aberto</b>.</p>
      </div>
      <div class="filtros" role="group" aria-label="Filtrar notas">
        ${FILTROS.map(([k, rot]) => `<button type="button" class="chip" data-filtro="${k}" aria-pressed="${k === filtro}">${rot}</button>`).join('')}
      </div>
      <p class="filtro-status" role="status" aria-live="polite"></p>
      <ol class="dedi-lista" id="lista"></ol>

      <h2 style="margin-top: var(--esp-6)">Fontes e divergências</h2>
      <div class="cartao">
        <p>Estes dedilhados foram conferidos em mais de uma fonte. Onde elas discordam, o app avisa e guarda as duas versões:</p>
        <ul>${dados.divergencias.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        <h3>Fontes consultadas</h3>
        <ul>${Object.values(dados.fontes).map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)}</a> — <small>${esc(f.tipo)}</small></li>`).join('')}</ul>
        <p class="aviso">Nenhuma nota foi ainda testada na <b>sua</b> ocarina. Para corrigir algo, edite <code>data/dedilhados.json</code> e marque <code>validada_na_minha_ocarina</code> quando confirmar.</p>
      </div>
    </section>`;

  const lista = raiz.querySelector('#lista');
  const status = raiz.querySelector('.filtro-status');

  function cartao(n) {
    const nm = nomeNota(n.id);
    const d = descreverDedilhado(layout, n.cobertos);
    const li = document.createElement('li');
    li.className = 'dedi-card';
    li.id = `nota-${n.id.replace('#', 's')}`;
    li.innerHTML = `
      <div class="dedi-mini"></div>
      <div class="dedi-info">
        <h3><span class="dedi-pt">${nm.pt}</span> <span class="dedi-letra">${nm.letra}</span></h3>
        <p class="dedi-sub">${nm.enarmonica ? `ou ${nm.enarmonica.pt} · ${nm.enarmonica.letra} · ` : ''}${frequenciaMidi(n.midi, a4).toFixed(1)} Hz</p>
        <ul class="dedilhado-txt">
          <li><b>Mão esquerda</b><span>${d.esquerda}</span></li>
          <li><b>Mão direita</b><span>${d.direita}</span></li>
          <li><b>Sub-furos</b><span>${d.subs ? 'cobrir ' + d.subs : 'abertos'}</span></li>
        </ul>
        <div class="dedi-selos">
          <span class="selo selo-${n.confianca}">${SELOS[n.confianca]}</span>
          ${n.validada_na_minha_ocarina ? '<span class="selo selo-alta">Testada por você</span>' : ''}
        </div>
        ${n.confianca !== 'alta' ? `<p class="dedi-obs">${esc(n.observacao)}</p>` : ''}
        <div class="dedi-alt"></div>
        <div class="dedi-acoes">
          <button type="button" class="btn" data-ouvir="${n.id}" aria-label="Ouvir ${rotuloCompleto(n.id)}">▶ Ouvir</button>
          <a class="btn" href="#/ocarina/${encodeURIComponent(n.id)}">Ver na ocarina</a>
        </div>
      </div>`;
    const mini = criarOcarinaSVG(layout, {
      miniatura: true,
      descricao: `Dedilhado de ${rotuloCompleto(n.id)}: ${d.total} furos cobertos`,
    });
    mini.definirCobertos(n.cobertos);
    li.querySelector('.dedi-mini').append(mini.svg);

    // alternativas: miniatura extra dentro de <details>
    (n.alternativas || []).forEach((alt, i) => {
      const da = descreverDedilhado(layout, alt.cobertos);
      const det = document.createElement('details');
      det.className = 'dedi-alt-det';
      det.innerHTML = `<summary>Dedilhado alternativo${n.alternativas.length > 1 ? ' ' + (i + 1) : ''}</summary>
        <div class="dedi-alt-corpo"><div class="dedi-mini dedi-mini-alt"></div>
        <div><p>${esc(alt.observacao)}</p>
        <p class="dedi-sub">Esquerda: ${da.esquerda} · Direita: ${da.direita}${da.subs ? ' · Sub-furos: ' + da.subs : ''}</p></div></div>`;
      const m2 = criarOcarinaSVG(layout, { miniatura: true, descricao: `Dedilhado alternativo de ${rotuloCompleto(n.id)}` });
      m2.definirCobertos(alt.cobertos);
      det.querySelector('.dedi-mini').append(m2.svg);
      li.querySelector('.dedi-alt').append(det);
    });
    return li;
  }

  const cartoes = new Map(notas.map((n) => [n.id, cartao(n)]));
  lista.append(...cartoes.values());

  function aplicarFiltro() {
    const teste = FILTROS.find(([k]) => k === filtro)[2];
    let visiveis = 0;
    for (const n of notas) {
      const mostra = teste(n);
      cartoes.get(n.id).hidden = !mostra;
      if (mostra) visiveis++;
    }
    status.textContent = `${visiveis} de ${notas.length} notas`;
    raiz.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtro)));
  }
  raiz.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => { filtro = b.dataset.filtro; salvar('tabela.filtro', filtro); aplicarFiltro(); }));

  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ouvir]');
    if (!b) return;
    garantirAudio();
    const n = notas.find((x) => x.id === b.dataset.ouvir);
    tocarNota(n.midi, { a4 });
  });

  aplicarFiltro();
}
