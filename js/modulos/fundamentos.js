// Módulo "Fundamentos": lista de mini-lições (#/fundamentos) e cada lição (#/fundamentos/<id>).
import { obterOcarina } from '../ocarina/dedilhados.js';
import { WIDGETS } from '../fundamentos/widgets.js';
import { montarEtapa } from '../fundamentos/exercicios.js';
import { progressoLicoes, registrarLicao } from '../progresso.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cacheLicoes = null;
export function obterLicoes() {
  cacheLicoes ??= fetch(new URL('../../data/licoes.json', import.meta.url))
    .then((r) => { if (!r.ok) throw new Error(`Não consegui carregar licoes.json (${r.status})`); return r.json(); })
    .then((d) => d.licoes)
    .catch((e) => { cacheLicoes = null; throw e; });
  return cacheLicoes;
}

export async function montar(raiz, params = []) {
  raiz.innerHTML = '<p role="status">Carregando lições…</p>';
  let licoes, O;
  try {
    [licoes, O] = await Promise.all([obterLicoes(), obterOcarina()]);
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar as lições (${esc(e.message)}). Se abriu por file://, use um servidor local — veja o README.</div>`;
    return;
  }
  const idx = licoes.findIndex((l) => l.id === params[0]);
  return idx >= 0 ? montarLicao(raiz, licoes, idx, O) : montarLista(raiz, licoes);
}

// ------------------------------------------------------------------ lista
function montarLista(raiz, licoes) {
  const prog = progressoLicoes();
  const feitas = licoes.filter((l) => prog[l.id]?.concluida).length;
  const proxima = licoes.find((l) => !prog[l.id]?.concluida);
  raiz.innerHTML = `
    <section>
      <div class="tela-cab">
        <h1>Fundamentos musicais</h1>
        <p>Do zero absoluto: som, notas, oitavas, ritmo e um toque de pauta. Cada lição é curta, interativa e termina com um mini-exercício.</p>
      </div>
      <p class="filtro-status" role="status">${feitas} de ${licoes.length} lições concluídas</p>
      <ol class="licoes-lista">
        ${licoes.map((l, i) => {
          const p = prog[l.id];
          const estado = p?.concluida ? 'feita' : l === proxima ? 'proxima' : 'aberta';
          return `<li class="licao-card" data-estado="${estado}">
            <span class="licao-num" aria-hidden="true">${p?.concluida ? '✓' : i + 1}</span>
            <div class="licao-corpo">
              <h2><a href="#/fundamentos/${l.id}">${esc(l.titulo)}</a></h2>
              <p>${esc(l.resumo)}</p>
              <small>~${l.minutos} min · ${p?.concluida ? 'Concluída' : l === proxima ? 'Próxima da trilha' : 'Não iniciada'}</small>
            </div>
            <a class="btn ${l === proxima ? 'btn-primario' : ''}" href="#/fundamentos/${l.id}" aria-label="${p?.concluida ? 'Rever' : 'Começar'}: ${esc(l.titulo)}">${p?.concluida ? 'Rever' : 'Começar'}</a>
          </li>`;
        }).join('')}
      </ol>
      <p class="aviso" style="margin-top: var(--esp-4)">Você pode fazer as lições em qualquer ordem, mas a sequência sugerida vai do mais básico ao mais completo. O progresso fica salvo neste navegador.</p>
    </section>`;
}

// ------------------------------------------------------------------ lição
function montarLicao(raiz, licoes, idx, O) {
  const licao = licoes[idx];
  const anterior = licoes[idx - 1];
  const proxima = licoes[idx + 1];
  const destruidores = [];

  raiz.innerHTML = `
    <article class="licao">
      <p class="migalha"><a href="#/fundamentos">← Todas as lições</a> · Lição ${idx + 1} de ${licoes.length}</p>
      <h1>${esc(licao.titulo)}</h1>
      <p class="licao-resumo">${esc(licao.resumo)} <small>(~${licao.minutos} min)</small></p>
      <div class="licao-passos"></div>
      <section class="cartao exercicio" aria-labelledby="ex-h">
        <h2 id="ex-h">Mini-exercício: ${esc(licao.exercicio.titulo)}</h2>
        <div class="etapas"></div>
        <div class="concluida" hidden></div>
      </section>
      <nav class="licao-nav" aria-label="Navegar entre lições">
        ${anterior ? `<a class="btn" href="#/fundamentos/${anterior.id}">← ${esc(anterior.titulo)}</a>` : '<span></span>'}
        ${proxima ? `<a class="btn" href="#/fundamentos/${proxima.id}">${esc(proxima.titulo)} →</a>` : ''}
      </nav>
    </article>`;

  // passos: texto, destaque, widget
  const passos = raiz.querySelector('.licao-passos');
  for (const p of licao.passos) {
    if (p.tipo === 'texto') {
      const d = document.createElement('div');
      d.className = 'passo-texto';
      d.innerHTML = p.html;
      passos.append(d);
    } else if (p.tipo === 'destaque') {
      const d = document.createElement('div');
      d.className = 'destaque';
      d.innerHTML = p.html;
      passos.append(d);
    } else if (p.tipo === 'widget') {
      const fabrica = WIDGETS[p.widget];
      if (!fabrica) continue;
      const w = fabrica({ O });
      const cart = document.createElement('div');
      cart.className = 'cartao widget-cartao';
      cart.append(w.el);
      passos.append(cart);
      if (w.destruir) destruidores.push(w.destruir);
    }
  }

  // exercício em etapas: a seguinte só aparece depois de passar na anterior
  const etapasEl = raiz.querySelector('.etapas');
  const concluidaEl = raiz.querySelector('.concluida');
  const defs = licao.exercicio.etapas;
  const resultados = new Array(defs.length).fill(null);

  defs.forEach((def, i) => {
    const bloco = document.createElement('div');
    bloco.className = 'etapa';
    bloco.hidden = i > 0;
    if (defs.length > 1) {
      const h = document.createElement('h3');
      h.textContent = `Etapa ${i + 1} de ${defs.length}`;
      bloco.append(h);
    }
    const e = montarEtapa(def, {
      O,
      aoTerminar: (r) => {
        if (r.aprovada) resultados[i] = r;
        if (r.aprovada && defs[i + 1]) {
          const prox = etapasEl.children[i + 1];
          if (prox.hidden) { prox.hidden = false; prox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        }
        if (resultados.every(Boolean)) concluir();
      },
    });
    bloco.append(e.el);
    if (e.destruir) destruidores.push(e.destruir);
    etapasEl.append(bloco);
  });

  function concluir() {
    const acertos = resultados.reduce((s, r) => s + r.acertos, 0);
    const total = resultados.reduce((s, r) => s + r.total, 0);
    registrarLicao(licao.id, { acertos, total, aprovada: true });
    concluidaEl.hidden = false;
    concluidaEl.innerHTML = `
      <div class="lic-ok" role="status">
        <p><b>✓ Lição concluída!</b> Progresso salvo (${acertos} de ${total} no exercício).</p>
        <p>${proxima ? `<a class="btn btn-primario" href="#/fundamentos/${proxima.id}">Próxima: ${esc(proxima.titulo)} →</a>` : '<a class="btn btn-primario" href="#/ocarina">Praticar na ocarina →</a>'}</p>
      </div>`;
  }
  // se já estava concluída, mostra o selo (sem exigir refazer)
  if (progressoLicoes()[licao.id]?.concluida) {
    concluidaEl.hidden = false;
    concluidaEl.innerHTML = '<div class="lic-ok"><p><b>✓ Você já concluiu esta lição.</b> Pode refazer o exercício quando quiser.</p></div>';
  }

  return () => destruidores.forEach((f) => { try { f(); } catch { /* ignora */ } });
}
