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
