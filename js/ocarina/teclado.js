// Régua/teclado das 21 notas da ocarina (A4–F6), com teclas brancas (naturais) e pretas (sustenidos).
import { nomeNota, rotuloCompleto } from './dedilhados.js';

export function criarTeclado(notas, aoEscolher) {
  const naturais = notas.filter(n => nomeNota(n.id).natural);
  const wrap = document.createElement('div');
  wrap.className = 'teclado-rolagem';
  const teclado = document.createElement('div');
  teclado.className = 'teclado';
  teclado.style.setProperty('--n-brancas', naturais.length);
  teclado.setAttribute('role', 'group');
  teclado.setAttribute('aria-label', 'Notas da ocarina, de Lá 4 a Fá 6');
  wrap.append(teclado);

  const botoes = new Map();
  const criar = (n, classe, html) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tecla ${classe}`;
    b.dataset.id = n.id;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', rotuloCompleto(n.id));
    b.innerHTML = html;
    b.addEventListener('click', () => aoEscolher(n.id));
    botoes.set(n.id, b);
    return b;
  };

  naturais.forEach(n => {
    const nm = nomeNota(n.id);
    teclado.append(criar(n, 'tecla-branca', `<span class="pt">${nm.pt}</span><span class="lt">${nm.letra}</span>`));
  });
  // preta = entre a natural anterior e a próxima: posição = (índice da natural anterior + 1) / n
  notas.filter(n => !nomeNota(n.id).natural).forEach(n => {
    const anterior = notas.filter(x => x.midi < n.midi && nomeNota(x.id).natural).length; // naturais à esquerda
    const b = criar(n, 'tecla-preta', '♯');
    b.style.left = `calc(2px + (100% - 4px) * ${anterior} / ${naturais.length} - var(--larg-preta) / 2)`;
    teclado.append(b);
  });

  return {
    el: wrap,
    marcar(id) {
      for (const [k, b] of botoes) b.setAttribute('aria-pressed', String(k === id));
      const b = botoes.get(id);
      if (b) {
        // mantém a tecla visível na rolagem horizontal (celular)
        const alvo = b.offsetLeft - wrap.clientWidth / 2 + b.offsetWidth / 2;
        wrap.scrollTo({ left: alvo, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    },
  };
}
