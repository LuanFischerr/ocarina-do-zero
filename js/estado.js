// Preferências e progresso em localStorage. Sempre com try/catch: pode estar bloqueado (aba anônima etc.).
const PREFIXO = 'ocarina-do-zero:';

export function ler(chave, padrao = null) {
  try {
    const v = localStorage.getItem(PREFIXO + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch {
    return padrao;
  }
}

export function salvar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

/** Todas as chaves do app (sem o prefixo) com seus valores, para exportar o progresso. */
export function todasChaves() {
  const saida = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIXO)) continue;
      try { saida[k.slice(PREFIXO.length)] = JSON.parse(localStorage.getItem(k)); } catch { /* ignora valor inválido */ }
    }
  } catch { /* localStorage indisponível */ }
  return saida;
}

/** Grava várias chaves de uma vez (usado ao importar). Retorna quantas foram gravadas. */
export function gravarChaves(obj) {
  let n = 0;
  for (const [k, v] of Object.entries(obj)) if (salvar(k, v)) n++;
  return n;
}

/** Remove as chaves do app que passam no filtro. */
export function removerChaves(filtro) {
  try {
    for (const k of Object.keys(todasChaves())) if (filtro(k)) localStorage.removeItem(PREFIXO + k);
  } catch { /* ignora */ }
}
