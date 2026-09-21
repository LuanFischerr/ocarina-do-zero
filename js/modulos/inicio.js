import { obterOcarina } from '../ocarina/dedilhados.js';
import { criarOcarinaSVG } from '../ocarina/ocarina-svg.js';
import { obterLicoes } from './fundamentos.js';
import { progressoLicoes, progressoTecnica } from '../progresso.js';
import { obterTecnica } from './tecnica.js';

const TRILHA = [
  { chave: 'fundamentos', titulo: 'Fundamentos musicais', texto: 'Som, notas (Dó Ré Mi = C D E), oitavas, ritmo e pauta.', rota: '#/fundamentos', status: 'disponivel' },
  { titulo: 'Ocarina interativa', texto: 'Furos, notas e som. Já dá para explorar.', rota: '#/ocarina', status: 'disponivel' },
  { chave: 'tecnica', titulo: 'Técnica de ocarina', texto: 'Postura, sopro suave, articulação e respiração.', rota: '#/tecnica', status: 'disponivel' },
  { chave: 'pratica', titulo: 'Prática com feedback', texto: 'Quiz, modo escuta com microfone e modo guiado.', rota: '#/pratica', status: 'disponivel' },
  { titulo: 'Repertório Zelda', texto: 'Melodias curtas, da mais fácil para a mais difícil.', status: 'breve' },
  { titulo: 'Progresso', texto: 'O que você já domina e o que ainda erra.', status: 'breve' },
];

export async function montar(raiz) {
  // status dinâmico dos Fundamentos (lições concluídas)
  let resumoFund = '';
  let fundCompleto = false;
  try {
    const licoes = await obterLicoes();
    const p = progressoLicoes();
    const n = licoes.filter((l) => p[l.id]?.concluida).length;
    resumoFund = ` · ${n} de ${licoes.length} lições concluídas`;
    fundCompleto = n === licoes.length;
  } catch { /* segue sem o resumo */ }
  let resumoTec = '';
  let tecCompleto = false;
  try {
    const t = await obterTecnica();
    const p = progressoTecnica();
    const n = t.topicos.filter((x) => p[x.id]?.praticado).length;
    resumoTec = ` · ${n} de ${t.topicos.length} temas praticados`;
    tecCompleto = n === t.topicos.length;
  } catch { /* segue sem o resumo */ }

  raiz.innerHTML = `
    <section class="hero">
      <div class="hero-texto">
        <h1>Aprenda ocarina do zero</h1>
        <p>Sem precisar saber música. Cada nota mostra onde colocar os dedos e como ela soa.</p>
        <div class="hero-acoes">
          <a class="btn btn-primario" href="#/fundamentos">Começar pelos fundamentos</a>
          <a class="btn" href="#/ocarina">Explorar a ocarina</a>
        </div>
      </div>
      <div class="cartao ocarina-cartao" id="hero-oc" aria-hidden="true"></div>
    </section>
    <section aria-labelledby="trilha-h">
      <h2 id="trilha-h">Trilha de estudo</h2>
      <ol class="trilha">
        ${TRILHA.map(t => `
          <li data-status="${(t.chave === 'fundamentos' && fundCompleto) || (t.chave === 'tecnica' && tecCompleto) ? 'pronto' : t.status}">
            <div>
              <strong>${t.rota ? `<a href="${t.rota}">${t.titulo}</a>` : t.titulo}</strong>
              <small>${t.texto}${t.status === 'breve' ? ' · em breve' : ''}${t.chave === 'fundamentos' ? resumoFund : t.chave === 'tecnica' ? resumoTec : ''}</small>
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
