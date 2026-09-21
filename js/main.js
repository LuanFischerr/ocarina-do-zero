// Ponto de entrada: roteador por hash (#/inicio, #/ocarina/G5, #/fundamentos/ritmo, #/tecnica/sopro, #/tabela) — funciona em GitHub Pages sem configuração.
import { ler, salvar } from './estado.js';

const ROTAS = {
  inicio: { titulo: 'Início', carregar: () => import('./modulos/inicio.js') },
  fundamentos: { titulo: 'Fundamentos', carregar: () => import('./modulos/fundamentos.js') },
  ocarina: { titulo: 'Ocarina', carregar: () => import('./modulos/ocarina.js') },
  tecnica: { titulo: 'Técnica', carregar: () => import('./modulos/tecnica.js') },
  tabela: { titulo: 'Tabela', carregar: () => import('./modulos/tabela.js') },
};
const EM_BREVE = ['Prática', 'Repertório', 'Progresso'];

const conteudo = document.getElementById('conteudo');
const nav = document.getElementById('nav');
let limpar = null;
let token = 0;

nav.innerHTML =
  Object.entries(ROTAS).map(([k, r]) => `<a href="#/${k}" data-rota="${k}">${r.titulo}</a>`).join('') +
  EM_BREVE.map(t => `<span aria-disabled="true" title="Em breve">${t}</span>`).join('');

async function navegar() {
  const [rota, ...params] = (location.hash.replace(/^#\/?/, '') || 'inicio').split('/').map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  const nome = ROTAS[rota] ? rota : 'inicio';
  const meu = ++token;
  if (typeof limpar === 'function') { limpar(); limpar = null; }
  nav.querySelectorAll('a').forEach((a) => {
    const atual = a.dataset.rota === nome;
    if (atual) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ inline: 'center', block: 'nearest' }); }
    else a.removeAttribute('aria-current');
  });
  document.title = `${ROTAS[nome].titulo} · Ocarina do Zero`;
  try {
    const mod = await ROTAS[nome].carregar();
    if (meu !== token) return;
    const r = await mod.montar(conteudo, params);
    if (meu === token) limpar = r;
    else if (typeof r === 'function') r();
  } catch (e) {
    conteudo.innerHTML = `<div class="aviso" role="alert">Algo deu errado ao abrir esta tela: ${e.message}</div>`;
  }
  if (meu === token) { window.scrollTo(0, 0); conteudo.focus({ preventScroll: true }); }
}
window.addEventListener('hashchange', navegar);
navegar();

// ---- tema: automático -> claro -> escuro ----
const temaBtn = document.getElementById('tema-btn');
function aplicarTema(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', t);
  temaBtn.title = `Tema: ${t}`;
}
let tema = ler('tema', 'auto');
aplicarTema(tema);
temaBtn.addEventListener('click', () => {
  tema = { auto: 'claro', claro: 'escuro', escuro: 'auto' }[tema];
  salvar('tema', tema);
  aplicarTema(tema);
});
