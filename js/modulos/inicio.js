import { obterOcarina } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';

const TRILHA = [
  { titulo: 'Ocarina interativa', texto: 'Furos, notas e som. Comece por aqui.', rota: '#/ocarina', status: 'pronto' },
  { titulo: 'Fundamentos musicais', texto: 'Som, notas (Dó Ré Mi = C D E), oitavas, ritmo.', status: 'breve' },
  { titulo: 'Técnica de ocarina', texto: 'Postura, sopro suave, articulação e respiração.', status: 'breve' },
  { titulo: 'Prática com feedback', texto: 'Quiz, modo escuta com microfone e modo guiado.', status: 'breve' },
  { titulo: 'Repertório Zelda', texto: 'Melodias curtas, da mais fácil para a mais difícil.', status: 'breve' },
  { titulo: 'Progresso', texto: 'O que você já domina e o que ainda erra.', status: 'breve' },
];

export async function montar(raiz) {
  raiz.innerHTML = `
    <section class="hero">
      <div class="hero-texto">
        <h1>Aprenda ocarina do zero</h1>
        <p>Sem precisar saber música. Cada nota mostra onde colocar os dedos e como ela soa.</p>
        <div class="hero-acoes">
          <a class="btn btn-primario" href="#/ocarina">Explorar a ocarina</a>
        </div>
      </div>
      <div class="cartao ocarina-cartao" id="hero-oc" aria-hidden="true"></div>
    </section>
    <section aria-labelledby="trilha-h">
      <h2 id="trilha-h">Trilha de estudo</h2>
      <ol class="trilha">
        ${TRILHA.map(t => `
          <li data-status="${t.status}">
            <div>
              <strong>${t.rota ? `<a href="${t.rota}">${t.titulo}</a>` : t.titulo}</strong>
              <small>${t.texto}${t.status === 'breve' ? ' · em breve' : ''}</small>
            </div>
          </li>`).join('')}
      </ol>
    </section>`;

  try {
    const { layout, porId } = await obterOcarina();
    const oc = criarOcarinaSVG(layout, { orientacao: 'horizontal' });
    raiz.querySelector('#hero-oc').append(oc.svg);
    oc.definirCobertos(porId.get('C5').cobertos);
  } catch {
    raiz.querySelector('#hero-oc')?.remove();
  }
}
