// Tela "Ocarina": nota -> dedilhado (com som) e furos -> nota (modo inverso).
import { obterOcarina, nomeNota, rotuloCompleto, identificar, quaseLa, descreverDedilhado } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { criarTeclado } from '../ocarina/teclado.js';
import { tocarNota, frequenciaMidi, definirVolume, garantirAudio } from '../audio/sintese.js';
import { ler, salvar } from '../estado.js';

const SELOS = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' };
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

export async function montar(raiz, params = []) {
  raiz.innerHTML = '<p role="status">Carregando a ocarina…</p>';
  let O;
  try {
    O = await obterOcarina();
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar os dados da ocarina (${e.message}). Se você abriu o arquivo direto (file://), rode um servidor local — veja o README.</div>`;
    return;
  }
  const { layout, notas, porId, indice, dados } = O;
  const a4 = dados.referencia_a4_hz;

  const estado = {
    modo: 'nota',                       // 'nota' | 'furos'
    notaId: ler('ocarina.nota', 'C5'),
    usarAlt: null,                      // índice da alternativa mostrada, ou null
  };
  if (params[0] && porId.has(params[0])) estado.notaId = params[0]; // link direto: #/ocarina/G5
  if (!porId.has(estado.notaId)) estado.notaId = 'C5';
  let orient = null;
  let ocarina = null;

  raiz.innerHTML = '';
  const tela = html(`
    <section class="tela-ocarina">
      <div class="tela-cab">
        <h1>Ocarina interativa</h1>
        <p>Escolha uma nota para ver quais furos cobrir e ouvir o som — ou toque nos furos e descubra que nota você fez. <a href="#/tabela">Ver tabela completa</a></p>
      </div>
      <div class="modos" role="tablist" aria-label="Modo">
        <button role="tab" id="tab-nota" aria-selected="true" aria-controls="painel-modo">Nota → dedilhado</button>
        <button role="tab" id="tab-furos" aria-selected="false" aria-controls="painel-modo">Furos → nota</button>
      </div>
      <div class="palco">
        <div class="cartao ocarina-cartao" id="ocarina-cartao">
          <div id="ocarina-slot"></div>
          <div class="legenda" aria-hidden="true">
            <span class="l-esq"><i></i>Mão esquerda</span>
            <span class="l-dir"><i></i>Mão direita</span>
            <span class="l-verso"><i></i>Polegares (atrás)</span>
            <span class="l-fech"><i></i>Furo coberto</span>
          </div>
        </div>
        <aside class="cartao painel" id="painel-modo" role="tabpanel" aria-live="polite"></aside>
      </div>
      <div class="cartao teclado-cartao" style="margin-top: var(--esp-4)">
        <h2>Régua de notas <small style="font-weight:400;color:var(--tinta-suave)">— toque para ouvir e ver o dedilhado</small></h2>
        <div id="teclado-slot"></div>
      </div>
    </section>`);
  raiz.append(tela);

  const slot = tela.querySelector('#ocarina-slot');
  const cartao = tela.querySelector('#ocarina-cartao');
  const painel = tela.querySelector('#painel-modo');
  const tabs = { nota: tela.querySelector('#tab-nota'), furos: tela.querySelector('#tab-furos') };

  const teclado = criarTeclado(notas, id => { escolherNota(id, { tocar: true }); });
  tela.querySelector('#teclado-slot').append(teclado.el);

  // ---------- ocarina (re)criada conforme largura: vertical no celular ----------
  function montarOcarina() {
    const vertical = cartao.clientWidth < 620;
    const nova = vertical ? 'vertical' : 'horizontal';
    if (nova === orient && ocarina) return;
    const cobertos = ocarina ? ocarina.obterCobertos() : [];
    orient = nova;
    cartao.dataset.orient = nova;
    ocarina = criarOcarinaSVG(layout, {
      interativo: estado.modo === 'furos',
      orientacao: nova,
      aoAlternar: alternarFuro,
    });
    ocarina.mostrarRotulos(ler('ocarina.rotulos', true));
    slot.replaceChildren(ocarina.svg);
    ocarina.definirCobertos(cobertos);
  }
  const ro = new ResizeObserver(() => montarOcarina());
  ro.observe(cartao);

  function refazerOcarinaInterativa() {
    const cobertos = ocarina.obterCobertos();
    orient = null;
    montarOcarina();
    ocarina.definirCobertos(cobertos);
  }

  // ---------- comportamento ----------
  function dedilhadoAtual() {
    const n = porId.get(estado.notaId);
    if (estado.usarAlt != null && n.alternativas?.[estado.usarAlt]) return n.alternativas[estado.usarAlt].cobertos;
    return n.cobertos;
  }

  function escolherNota(id, { tocar = false } = {}) {
    if (estado.modo !== 'nota') definirModo('nota', { manterNota: true });
    estado.notaId = id;
    estado.usarAlt = null;
    salvar('ocarina.nota', id);
    history.replaceState(null, '', `#/ocarina/${encodeURIComponent(id)}`); // link compartilhável, sem recarregar a tela
    ocarina.definirCobertos(dedilhadoAtual(), { destacarMudancas: true });
    teclado.marcar(id);
    if (tocar) tocar_(id);
    desenharPainel();
  }

  function tocar_(id) {
    const n = porId.get(id);
    tocarNota(n.midi, { a4 });
  }

  function passo(delta) {
    const i = notas.findIndex(n => n.id === estado.notaId);
    const j = Math.min(notas.length - 1, Math.max(0, i + delta));
    escolherNota(notas[j].id, { tocar: true });
  }

  function alternarFuro(id) {
    garantirAudio();
    const cob = new Set(ocarina.obterCobertos());
    cob.has(id) ? cob.delete(id) : cob.add(id);
    ocarina.definirCobertos([...cob]);
    const achado = identificar(indice, [...cob]);
    if (achado) {
      estado.notaId = achado.nota.id;
      teclado.marcar(achado.nota.id);
      tocar_(achado.nota.id);
    }
    desenharPainel();
  }

  function definirModo(modo, { manterNota = false } = {}) {
    estado.modo = modo;
    for (const [k, b] of Object.entries(tabs)) b.setAttribute('aria-selected', String(k === modo));
    const cob = modo === 'nota' && !manterNota ? dedilhadoAtual() : ocarina.obterCobertos();
    refazerOcarinaInterativa();
    if (modo === 'nota') {
      ocarina.definirCobertos(dedilhadoAtual());
      teclado.marcar(estado.notaId);
    } else {
      ocarina.definirCobertos(cob);
    }
    desenharPainel();
  }
  tabs.nota.addEventListener('click', () => definirModo('nota'));
  tabs.furos.addEventListener('click', () => definirModo('furos'));

  // ---------- painel ----------
  function opcoesHTML() {
    return `
      <div class="opcoes">
        <label><input type="checkbox" id="opt-rotulos" ${ler('ocarina.rotulos', true) ? 'checked' : ''}> Mostrar números dos dedos</label>
        <label>Volume <input type="range" id="opt-vol" min="0" max="100" value="${ler('ocarina.volume', 60)}" aria-label="Volume"></label>
      </div>
      <p style="font-size:var(--texto-pequeno);color:var(--tinta-suave);margin:0">
        Dedos: <b>1</b> indicador · <b>2</b> médio · <b>3</b> anelar · <b>4</b> mínimo · <b>P</b> polegar (atrás) · <b>A/B</b> sub-furos.
      </p>`;
  }

  function ligarOpcoes() {
    painel.querySelector('#opt-rotulos')?.addEventListener('change', e => {
      ocarina.mostrarRotulos(e.target.checked);
      salvar('ocarina.rotulos', e.target.checked);
    });
    painel.querySelector('#opt-vol')?.addEventListener('input', e => {
      definirVolume(e.target.value / 100);
      salvar('ocarina.volume', +e.target.value);
    });
  }

  function desenharPainel() {
    if (estado.modo === 'nota') {
      const n = porId.get(estado.notaId);
      const nm = nomeNota(n.id);
      const cobertos = dedilhadoAtual();
      const d = descreverDedilhado(layout, cobertos);
      const alt = n.alternativas?.[0];
      painel.innerHTML = `
        <div class="painel-nota">
          <div class="nota-grande" aria-hidden="true">${nm.pt}</div>
          <div class="nota-nomes">
            <span class="letra">${rotuloCompleto(n.id)} · ${nm.letra}${nm.enarmonica ? ' / ' + nm.enarmonica.letra : ''}</span>
            <span class="freq">${frequenciaMidi(n.midi, a4).toFixed(1)} Hz</span>
          </div>
          <div class="stepper">
            <button class="btn" id="ant" type="button" aria-label="Nota anterior (mais grave)" ${n.midi === notas[0].midi ? 'disabled' : ''}>◀</button>
            <button class="btn" id="prox" type="button" aria-label="Próxima nota (mais aguda)" ${n.midi === notas.at(-1).midi ? 'disabled' : ''}>▶</button>
          </div>
        </div>
        <div style="display:flex;gap:var(--esp-2);flex-wrap:wrap;align-items:center">
          <button class="btn btn-primario" id="tocar" type="button">▶ Ouvir ${nm.pt}</button>
          <span class="selo selo-${n.confianca}">${SELOS[n.confianca]}</span>
          ${n.validada_na_minha_ocarina ? '<span class="selo selo-alta">Validada na minha ocarina</span>' : '<span class="selo selo-media">Ainda não testada na sua ocarina</span>'}
        </div>
        <ul class="dedilhado-txt" aria-label="Dedilhado em texto">
          <li><b>Mão esquerda</b><span>${d.esquerda}</span></li>
          <li><b>Mão direita</b><span>${d.direita}</span></li>
          <li><b>Sub-furos</b><span>${d.subs ? 'cobrir ' + d.subs : 'abertos'}</span></li>
        </ul>
        <p style="margin:0;font-size:var(--texto-pequeno);color:var(--tinta-suave)">${estado.usarAlt != null ? alt.observacao : n.observacao}</p>
        ${n.confianca !== 'alta' ? '<div class="aviso">As fontes não concordam totalmente nesta nota. Teste na sua ocarina e ajuste em <code>data/dedilhados.json</code> se precisar.</div>' : ''}
        ${alt ? `<button class="btn" id="alt" type="button">${estado.usarAlt != null ? 'Ver dedilhado principal' : 'Ver dedilhado alternativo'}</button>` : ''}
        ${opcoesHTML()}`;
      painel.querySelector('#ant').addEventListener('click', () => passo(-1));
      painel.querySelector('#prox').addEventListener('click', () => passo(1));
      painel.querySelector('#tocar').addEventListener('click', () => tocar_(estado.notaId));
      painel.querySelector('#alt')?.addEventListener('click', () => {
        estado.usarAlt = estado.usarAlt == null ? 0 : null;
        ocarina.definirCobertos(dedilhadoAtual(), { destacarMudancas: true });
        desenharPainel();
      });
    } else {
      const cob = ocarina.obterCobertos();
      const achado = identificar(indice, cob);
      let corpo;
      if (achado) {
        const n = achado.nota;
        const nm = nomeNota(n.id);
        corpo = `
          <div class="resultado" data-ok="true">
            <div class="grande">${rotuloCompleto(n.id)}</div>
            <div>${nm.letra}${nm.enarmonica ? ' / ' + nm.enarmonica.letra : ''} · ${frequenciaMidi(n.midi, a4).toFixed(1)} Hz${achado.alternativa ? ' · <em>dedilhado alternativo</em>' : ''}</div>
          </div>`;
      } else {
        const dica = quaseLa(notas, cob);
        corpo = `
          <div class="resultado" data-ok="false">
            <div class="grande">Nenhuma nota conhecida</div>
            <div>Essa combinação não está na tabela — ela pode soar desafinada ou fraca.
            ${dica ? `<br><b>Quase lá:</b> ${dica.acao === 'soltar' ? 'solte' : 'cubra'} <em>${layout.furos[dica.id].rotulo}</em> para fazer ${rotuloCompleto(dica.nota.id)}.` : ''}</div>
          </div>`;
      }
      painel.innerHTML = `
        <h2 style="margin:0">Furos → nota</h2>
        <p style="margin:0;color:var(--tinta-suave)">Toque nos furos para <b>cobrir</b> (preenchido) ou <b>abrir</b>. Dica: comece com tudo coberto e vá soltando um dedo por vez.</p>
        ${corpo}
        <div style="display:flex;gap:var(--esp-2);flex-wrap:wrap">
          <button class="btn" id="tampar" type="button">Cobrir tudo</button>
          <button class="btn" id="abrir" type="button">Abrir tudo</button>
          <button class="btn btn-primario" id="tocar" type="button" ${achado ? '' : 'disabled'}>▶ Ouvir</button>
        </div>
        ${opcoesHTML()}`;
      const todos = Object.keys(layout.furos);
      const apenas10 = todos.filter(id => layout.furos[id].tipo !== 'sub');
      painel.querySelector('#tampar').addEventListener('click', () => { garantirAudio(); ocarina.definirCobertos(apenas10, { destacarMudancas: true }); alternarPosLimpar(); });
      painel.querySelector('#abrir').addEventListener('click', () => { ocarina.definirCobertos([], { destacarMudancas: true }); desenharPainel(); });
      painel.querySelector('#tocar').addEventListener('click', () => { const a = identificar(indice, ocarina.obterCobertos()); if (a) tocar_(a.nota.id); });
    }
    ligarOpcoes();
  }

  function alternarPosLimpar() {
    const a = identificar(indice, ocarina.obterCobertos());
    if (a) { estado.notaId = a.nota.id; teclado.marcar(a.nota.id); tocar_(a.nota.id); }
    desenharPainel();
  }

  // setas do teclado passam de nota (só no modo nota e fora de campos de formulário)
  function aoTeclar(e) {
    if (estado.modo !== 'nota') return;
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); passo(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); passo(-1); }
  }
  document.addEventListener('keydown', aoTeclar);

  // estado inicial
  montarOcarina();
  definirVolume(ler('ocarina.volume', 60) / 100);
  ocarina.definirCobertos(dedilhadoAtual());
  teclado.marcar(estado.notaId);
  desenharPainel();

  return () => { ro.disconnect(); document.removeEventListener('keydown', aoTeclar); };
}
