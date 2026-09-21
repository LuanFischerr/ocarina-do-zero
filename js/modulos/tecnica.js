// Módulo "Técnica": lista de tópicos (#/tecnica) e cada tópico (#/tecnica/<id>).
import { obterOcarina } from '../ocarina/dedilhados.js';
import { WIDGETS_TECNICA } from '../tecnica/widgets.js';
import { ILUSTRACOES } from '../tecnica/ilustracoes.js';
import { progressoTecnica, marcarTecnica } from '../progresso.js';
import { ler, salvar } from '../estado.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cache = null;
export function obterTecnica() {
  cache ??= fetch(new URL('../../data/tecnica.json', import.meta.url))
    .then((r) => { if (!r.ok) throw new Error(`Não consegui carregar tecnica.json (${r.status})`); return r.json(); })
    .then((d) => { d._topicos = d.topicos; return d; })
    .catch((e) => { cache = null; throw e; });
  return cache;
}

export async function montar(raiz, params = []) {
  raiz.innerHTML = '<p role="status">Carregando a técnica…</p>';
  let dados, O;
  try {
    [dados, O] = await Promise.all([obterTecnica(), obterOcarina()]);
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar o conteúdo (${esc(e.message)}). Se abriu por file://, use um servidor local — veja o README.</div>`;
    return;
  }
  const idx = dados.topicos.findIndex((t) => t.id === params[0]);
  return idx >= 0 ? montarTopico(raiz, dados, idx, O) : montarLista(raiz, dados);
}

// ------------------------------------------------------------------ lista
function montarLista(raiz, dados) {
  const prog = progressoTecnica();
  const feitos = dados.topicos.filter((t) => prog[t.id]?.praticado).length;
  raiz.innerHTML = `
    <section>
      <div class="tela-cab">
        <h1>Técnica de ocarina</h1>
        <p>Postura, mãos, sopro, língua, respiração e cuidados, com ilustrações e experimentos interativos. Marque cada tema como praticado quando tiver testado com a sua ocarina.</p>
      </div>
      <p class="filtro-status" role="status">${feitos} de ${dados.topicos.length} temas praticados</p>
      <ol class="licoes-lista">
        ${dados.topicos.map((t, i) => {
          const p = prog[t.id]?.praticado;
          return `<li class="licao-card" data-estado="${p ? 'feita' : 'aberta'}">
            <span class="licao-num" aria-hidden="true">${p ? '✓' : i + 1}</span>
            <div class="licao-corpo">
              <h2><a href="#/tecnica/${t.id}">${esc(t.titulo)}</a></h2>
              <p>${esc(t.resumo)}</p>
              <small>~${t.minutos} min · ${p ? 'Praticado' : 'Ainda não praticado'}</small>
            </div>
            <a class="btn" href="#/tecnica/${t.id}" aria-label="${p ? 'Rever' : 'Abrir'}: ${esc(t.titulo)}">${p ? 'Rever' : 'Abrir'}</a>
          </li>`;
        }).join('')}
      </ol>
      <p class="aviso" style="margin-top: var(--esp-4)">Estas dicas seguem fontes de fabricantes e professores de ocarina (listadas no fim de cada tema). Se o fabricante da sua ocarina disser outra coisa, vale mais a instrução dele.</p>
    </section>`;
}

// ------------------------------------------------------------------ tópico
function montarTopico(raiz, dados, idx, O) {
  const t = dados.topicos[idx];
  const anterior = dados.topicos[idx - 1];
  const proximo = dados.topicos[idx + 1];
  const destruidores = [];

  raiz.innerHTML = `
    <article class="licao tecnica">
      <p class="migalha"><a href="#/tecnica">← Todos os temas</a> · Tema ${idx + 1} de ${dados.topicos.length}</p>
      <h1>${esc(t.titulo)}</h1>
      <p class="licao-resumo">${esc(t.resumo)} <small>(~${t.minutos} min)</small></p>
      <div class="licao-passos"></div>
      <section class="cartao praticado" aria-labelledby="pr-h">
        <h2 id="pr-h">Já praticou este tema?</h2>
        <p class="w-dica">Marque quando tiver testado na sua ocarina. Isso alimenta o seu progresso.</p>
        <label class="pr-marca"><input type="checkbox" id="pr-check"> <span>Pratiquei e entendi este tema</span></label>
      </section>
      <section class="fontes-tema" aria-labelledby="fo-h">
        <h2 id="fo-h">Fontes</h2>
        <ul>${t.fontes.map((k) => `<li><a href="${esc(dados.fontes[k].url)}" target="_blank" rel="noopener noreferrer">${esc(dados.fontes[k].titulo)}</a></li>`).join('')}</ul>
      </section>
      <nav class="licao-nav" aria-label="Navegar entre temas">
        ${anterior ? `<a class="btn" href="#/tecnica/${anterior.id}">← ${esc(anterior.titulo)}</a>` : '<span></span>'}
        ${proximo ? `<a class="btn" href="#/tecnica/${proximo.id}">${esc(proximo.titulo)} →</a>` : ''}
      </nav>
    </article>`;

  const passos = raiz.querySelector('.licao-passos');
  for (const p of t.passos) {
    if (p.tipo === 'texto' || p.tipo === 'destaque') {
      const d = document.createElement('div');
      d.className = p.tipo === 'texto' ? 'passo-texto' : 'destaque';
      d.innerHTML = p.html;
      passos.append(d);
    } else if (p.tipo === 'figura') {
      const f = ILUSTRACOES[p.figura];
      if (!f) continue;
      const fig = document.createElement('figure');
      fig.className = 'cartao figura';
      fig.innerHTML = `${f()}<figcaption>${esc(p.legenda ?? '')}</figcaption>`;
      passos.append(fig);
    } else if (p.tipo === 'widget') {
      const fabrica = WIDGETS_TECNICA[p.widget];
      if (!fabrica) continue;
      const w = fabrica({ O, dados, passo: p });
      const cart = document.createElement('div');
      cart.className = 'cartao widget-cartao';
      cart.append(w.el);
      passos.append(cart);
      if (w.destruir) destruidores.push(w.destruir);
    } else if (p.tipo === 'checklist') {
      passos.append(criarChecklist(p));
    }
  }

  const check = raiz.querySelector('#pr-check');
  check.checked = !!progressoTecnica()[t.id]?.praticado;
  check.addEventListener('change', () => marcarTecnica(t.id, check.checked));

  return () => destruidores.forEach((f) => { try { f(); } catch { /* ignora */ } });
}

/** Checklist simples, com estado salvo no navegador. */
function criarChecklist(p) {
  const chave = `tecnica.check.${p.id}`;
  const marcados = new Set(ler(chave, []));
  const box = document.createElement('div');
  box.className = 'cartao checklist';
  box.innerHTML = `
    <h3>${esc(p.titulo)}</h3>
    <ul>${p.itens.map((it, i) => `<li><label><input type="checkbox" data-i="${i}" ${marcados.has(i) ? 'checked' : ''}> <span>${esc(it)}</span></label></li>`).join('')}</ul>
    <p class="w-dica ck-prog" role="status" aria-live="polite"></p>`;
  const prog = box.querySelector('.ck-prog');
  const atualiza = () => { prog.textContent = marcados.size === p.itens.length ? '✓ Tudo certo, pode soprar!' : `${marcados.size} de ${p.itens.length}`; };
  box.addEventListener('change', (e) => {
    const c = e.target.closest('input[data-i]');
    if (!c) return;
    const i = Number(c.dataset.i);
    c.checked ? marcados.add(i) : marcados.delete(i);
    salvar(chave, [...marcados]);
    atualiza();
  });
  atualiza();
  return box;
}
