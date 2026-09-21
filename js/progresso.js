// Progresso das lições (localStorage). Formato: { [idLicao]: { concluida, acertos, total, quando } }
import { ler, salvar } from './estado.js';

const CHAVE = 'progresso.licoes';

export function progressoLicoes() {
  return ler(CHAVE, {}) || {};
}

export function registrarLicao(id, { acertos, total, aprovada }) {
  const p = progressoLicoes();
  const anterior = p[id];
  p[id] = {
    concluida: !!(aprovada || anterior?.concluida),
    acertos: Math.max(acertos, anterior?.acertos ?? 0),
    total,
    quando: new Date().toISOString(),
  };
  salvar(CHAVE, p);
  return p[id];
}
