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

// ---- Técnica: tópicos marcados como "praticados" ----
const CHAVE_TEC = 'progresso.tecnica';

export function progressoTecnica() {
  return ler(CHAVE_TEC, {}) || {};
}

export function marcarTecnica(id, praticado) {
  const p = progressoTecnica();
  if (praticado) p[id] = { praticado: true, quando: new Date().toISOString() };
  else delete p[id];
  salvar(CHAVE_TEC, p);
  return p;
}
