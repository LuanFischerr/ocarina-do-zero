// Módulo "Progresso": trilha sugerida, domínio por nota (revisão espaçada), dias de estudo e backup.
import { obterOcarina, nomeNota, rotuloCompleto } from '../ocarina/dedilhados.js';
import { obterLicoes } from './fundamentos.js';
import { obterTecnica } from './tecnica.js';
import { obterMusicas } from './repertorio.js';
import {
  progressoLicoes, progressoTecnica, progressoMusicas, usos, diasDeEstudo, estatisticasNotas, classificarNota,
} from '../progresso.js';
import { todasChaves, gravarChaves, removerChaves } from '../estado.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cacheTrilha = null;
function obterTrilha() {
  cacheTrilha ??= fetch(new URL('../../data/trilha.json', import.meta.url))
    .then((r) => { if (!r.ok) throw new Error(`Não consegui carregar trilha.json (${r.status})`); return r.json(); })
    .then((d) => d.passos)
    .catch((e) => { cacheTrilha = null; throw e; });
  return cacheTrilha;
}

/** Resolve cada passo da trilha com título, rota e se já foi feito. */
function resolverTrilha(passos, { licoes, tecnica, musicas }) {
  const pl = progressoLicoes();
  const pt = progressoTecnica();
  const pm = progressoMusicas();
  const u = usos();
  return passos.map((p) => {
    if (p.tipo === 'licao') {
      const l = licoes.find((x) => x.id === p.id);
      return { ...p, rotulo: 'Fundamentos', titulo: l?.titulo ?? p.id, detalhe: l?.resumo ?? '', rota: `#/fundamentos/${p.id}`, feito: !!pl[p.id]?.concluida };
    }
    if (p.tipo === 'tecnica') {
      const t = tecnica.topicos.find((x) => x.id === p.id);
      return { ...p, rotulo: 'Técnica', titulo: t?.titulo ?? p.id, detalhe: t?.resumo ?? '', rota: `#/tecnica/${p.id}`, feito: !!pt[p.id]?.praticado };
    }
    if (p.tipo === 'musica') {
      const m = musicas.musicas.find((x) => x.id === p.id);
      return { ...p, rotulo: 'Repertório', titulo: m?.titulo ?? p.id, detalhe: 'Toque com 85% de acertos em andamento normal.', rota: `#/repertorio/${p.id}`, feito: !!pm[p.id]?.dominada };
    }
    return { ...p, rotulo: 'Prática', rota: p.rota ?? '#/pratica', feito: !!u[p.id] };
  });
}

/** Resumo para a home e para o topo da tela. */
export async function resumoProgresso() {
  const [passos, licoes, tecnica, musicas] = await Promise.all([obterTrilha(), obterLicoes(), obterTecnica(), obterMusicas()]);
  const trilha = resolverTrilha(passos, { licoes, tecnica, musicas });
  const feitos = trilha.filter((p) => p.feito).length;
  return { trilha, feitos, total: trilha.length, proximo: trilha.find((p) => !p.feito) ?? null };
}

export async function montar(raiz) {
  raiz.innerHTML = '<p role="status">Carregando o seu progresso…</p>';
  let O, dados;
  try {
    const [oc, licoes, tecnica, musicas, passos] = await Promise.all([obterOcarina(), obterLicoes(), obterTecnica(), obterMusicas(), obterTrilha()]);
    O = oc;
    dados = { licoes, tecnica, musicas, passos };
  } catch (e) {
    raiz.innerHTML = `<div class="aviso" role="alert">Não consegui carregar o progresso (${esc(e.message)}). Se abriu por file://, use um servidor local — veja o README.</div>`;
    return;
  }
  desenhar(raiz, O, dados);
}

function desenhar(raiz, O, { licoes, tecnica, musicas, passos }) {
  const trilha = resolverTrilha(passos, { licoes, tecnica, musicas });
  const feitos = trilha.filter((p) => p.feito).length;
  const proximo = trilha.find((p) => !p.feito);
  const pct = Math.round((feitos / trilha.length) * 100);
  const pl = progressoLicoes();
  const pt = progressoTecnica();
  const pm = progressoMusicas();
  const est = estatisticasNotas();
  const dias = diasDeEstudo();

  const notas = O.notas.map((n) => ({ n, c: classificarNota(n.id, est) }));
  const dominadas = notas.filter(({ c }) => c.tipo === 'dominada');
  const atencao = notas.filter(({ c }) => c.tipo === 'atencao' || (c.tentativas > 0 && c.vencida && c.tipo !== 'dominada'))
    .sort((a, b) => (a.c.taxa ?? 1) - (b.c.taxa ?? 1));
  const vistas = notas.filter(({ c }) => c.tentativas > 0).length;

  const stat = (rotulo, valor, total, extra = '') => `
    <li class="pg-stat"><span class="pg-num">${valor}${total != null ? `<small>/${total}</small>` : ''}</span><span class="pg-rot">${rotulo}</span>${extra ? `<small>${extra}</small>` : ''}</li>`;

  raiz.innerHTML = `
    <section class="progresso">
      <div class="tela-cab">
        <h1>Seu progresso</h1>
        <p>Tudo o que você já fez, o que vem a seguir e quais notas ainda pedem treino. Fica salvo neste navegador; use o backup no fim da página para levar para outro aparelho.</p>
      </div>

      <div class="cartao pg-proximo" data-fim="${!proximo}">
        <div class="pg-barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Trilha concluída"><i style="width:${pct}%"></i></div>
        <p class="pg-pct"><b>${pct}%</b> da trilha · ${feitos} de ${trilha.length} passos</p>
        ${proximo
          ? `<h2>Próximo passo</h2><p class="pg-prox-tit"><span class="selo selo-media">${proximo.rotulo}</span> <b>${esc(proximo.titulo)}</b></p>
             <p class="w-dica">${esc(proximo.detalhe ?? '')}</p><a class="btn btn-primario" href="${proximo.rota}">Continuar →</a>`
          : '<h2>Trilha completa!</h2><p>Você percorreu todos os passos. Continue praticando as canções e o quiz de revisão.</p>'}
      </div>

      <ul class="pg-stats" aria-label="Resumo">
        ${stat('Lições', licoes.filter((l) => pl[l.id]?.concluida).length, licoes.length)}
        ${stat('Temas de técnica', tecnica.topicos.filter((t) => pt[t.id]?.praticado).length, tecnica.topicos.length)}
        ${stat('Canções dominadas', musicas.musicas.filter((m) => pm[m.id]?.dominada).length, musicas.musicas.length)}
        ${stat('Notas dominadas', dominadas.length, O.notas.length)}
        ${stat('Dias de estudo', dias.total, null, dias.sequencia > 1 ? `🔥 ${dias.sequencia} dias seguidos` : dias.hoje ? 'hoje já estudou' : 'estude hoje!')}
      </ul>

      <h2>Trilha sugerida</h2>
      <ol class="pg-trilha">
        ${trilha.map((p, i) => `
          <li data-feito="${p.feito}" ${p === proximo ? 'data-atual="true"' : ''}>
            <span class="pg-marca" aria-hidden="true">${p.feito ? '✓' : i + 1}</span>
            <div class="pg-corpo"><a href="${p.rota}">${esc(p.titulo)}</a><small>${p.rotulo}${p.feito ? ' · concluído' : ''}</small></div>
          </li>`).join('')}
      </ol>

      <h2>Suas notas</h2>
      <div class="cartao">
        ${vistas
          ? `<ul class="pg-notas" aria-label="Domínio de cada nota">
              ${notas.map(({ n, c }) => `<li class="pg-nota" data-tipo="${c.tipo}" title="${rotuloCompleto(n.id)}: ${c.tentativas ? `${c.acertos} acertos, ${c.erros} erros` : 'ainda não vista'}">
                <b>${nomeNota(n.id).pt}</b><small>${c.tentativas ? Math.round(c.taxa * 100) + '%' : '—'}</small></li>`).join('')}
            </ul>
            <ul class="pg-legenda" aria-hidden="true">
              <li data-tipo="dominada">dominada</li><li data-tipo="aprendendo">aprendendo</li><li data-tipo="atencao">precisa de atenção</li><li data-tipo="nao-vista">não vista</li>
            </ul>`
          : '<p class="w-dica">Você ainda não fez nenhum quiz. Faça uma rodada para o app descobrir quais notas você já domina e quais pedem treino.</p>'}
        <div class="pg-listas">
          <div><h3>Para rever</h3>
            ${atencao.length
              ? `<ul class="pg-rever">${atencao.slice(0, 8).map(({ n, c }) => `<li><b>${rotuloCompleto(n.id)}</b> <small>${c.acertos} acertos · ${c.erros} erros${c.vencida ? ' · revisão vencida' : ''}</small></li>`).join('')}</ul>
                 <a class="btn btn-primario" href="#/pratica/quiz/revisao">Revisar agora</a>`
              : `<p class="w-dica">${vistas ? 'Nada para rever agora. Bom trabalho!' : 'Depois do primeiro quiz, as notas mais difíceis aparecem aqui.'}</p>`}
          </div>
          <div><h3>Já domino</h3>
            ${dominadas.length
              ? `<p>${dominadas.map(({ n }) => `<span class="selo selo-alta">${rotuloCompleto(n.id)}</span>`).join(' ')}</p>`
              : '<p class="w-dica">Uma nota fica dominada com pelo menos 3 acertos seguidos e bom aproveitamento.</p>'}
          </div>
        </div>
        <p class="w-dica">A revisão é espaçada: cada acerto seguido leva a nota para revisões mais distantes (1, 2, 4, 8 e 16 dias); um erro traz a nota de volta.</p>
      </div>

      <h2>Backup do progresso</h2>
      <div class="cartao pg-backup">
        <p>O progresso mora só neste navegador. Exporte um arquivo para guardar ou levar para outro aparelho, e importe-o lá.</p>
        <div class="w-linha">
          <button type="button" class="btn" data-exportar>⬇ Exportar progresso</button>
          <label class="btn" for="pg-importar">⬆ Importar</label>
          <input type="file" id="pg-importar" accept="application/json,.json" class="sr-only" data-importar>
          <button type="button" class="btn pg-perigo" data-zerar>Apagar tudo</button>
        </div>
        <p class="w-dica pg-msg" role="status" aria-live="polite"></p>
      </div>
    </section>`;

  // ---- backup ----
  const msg = raiz.querySelector('.pg-msg');
  raiz.querySelector('[data-exportar]').addEventListener('click', () => {
    const conteudo = JSON.stringify({ app: 'ocarina-do-zero', versao: 1, exportadoEm: new Date().toISOString(), dados: todasChaves() }, null, 2);
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocarina-do-zero-progresso-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    msg.textContent = 'Arquivo gerado. Guarde-o em um lugar seguro.';
  });
  raiz.querySelector('[data-importar]').addEventListener('change', async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    try {
      if (arq.size > 2_000_000) throw new Error('arquivo grande demais');
      const json = JSON.parse(await arq.text());
      if (json?.app !== 'ocarina-do-zero' || json.versao !== 1 || typeof json.dados !== 'object' || json.dados === null) throw new Error('não parece um backup deste app');
      const limpo = Object.fromEntries(Object.entries(json.dados).filter(([k]) => /^[\w.-]{1,80}$/.test(k)));
      if (!confirm(`Importar ${Object.keys(limpo).length} itens? Isto substitui o progresso atual neste navegador.`)) return;
      removerChaves((k) => k !== 'tema');
      gravarChaves(limpo);
      desenhar(raiz, O, { licoes, tecnica, musicas, passos });
      raiz.querySelector('.pg-msg').textContent = 'Progresso importado.';
    } catch (err) {
      msg.textContent = `Não consegui importar: ${err instanceof SyntaxError ? 'o arquivo não é um JSON válido' : err.message}.`;
    }
  });
  raiz.querySelector('[data-zerar]').addEventListener('click', () => {
    if (!confirm('Apagar todo o progresso deste navegador? Isto não pode ser desfeito. Exporte um backup antes, se quiser.')) return;
    removerChaves((k) => k !== 'tema');
    desenhar(raiz, O, { licoes, tecnica, musicas, passos });
    raiz.querySelector('.pg-msg').textContent = 'Progresso apagado.';
  });
}
