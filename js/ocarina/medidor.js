// Medidor de afinação: "muito grave · afinado · muito agudo". Usado na Técnica (sopro) e depois no modo escuta.
export const LIMITES = { afinado: 12, pouco: 30 }; // em cents

export function classificarCents(c) {
  if (c == null || Number.isNaN(c)) return { id: 'nenhum', rotulo: 'sem som', cor: 'neutro' };
  const a = Math.abs(c);
  if (a <= LIMITES.afinado) return { id: 'afinado', rotulo: 'afinado', cor: 'ok' };
  if (c < 0) return a <= LIMITES.pouco ? { id: 'pouco-grave', rotulo: 'um pouco grave', cor: 'aviso' } : { id: 'muito-grave', rotulo: 'muito grave', cor: 'erro' };
  return a <= LIMITES.pouco ? { id: 'pouco-agudo', rotulo: 'um pouco agudo', cor: 'aviso' } : { id: 'muito-agudo', rotulo: 'muito agudo', cor: 'erro' };
}

/** Cria o medidor. definir(cents) move a agulha (−50…+50); definir(null) = sem som. */
export function criarMedidor() {
  const el = document.createElement('div');
  el.className = 'medidor';
  el.innerHTML = `
    <div class="medidor-escala" aria-hidden="true">
      <span class="zona zona-erro"></span><span class="zona zona-aviso"></span><span class="zona zona-ok"></span><span class="zona zona-aviso"></span><span class="zona zona-erro"></span>
      <span class="agulha"></span>
    </div>
    <div class="medidor-rotulos" aria-hidden="true"><span>muito grave</span><span>afinado</span><span>muito agudo</span></div>
    <p class="medidor-texto" role="status" aria-live="polite"><b class="m-estado">sem som</b> <span class="m-cents"></span></p>`;
  const agulha = el.querySelector('.agulha');
  const estado = el.querySelector('.m-estado');
  const centsEl = el.querySelector('.m-cents');

  function definir(c) {
    const cls = classificarCents(c);
    el.dataset.estado = cls.cor;
    if (c == null || Number.isNaN(c)) {
      agulha.style.left = '50%';
      agulha.style.opacity = '0.25';
      estado.textContent = cls.rotulo;
      centsEl.textContent = '';
      return cls;
    }
    const limitado = Math.max(-50, Math.min(50, c));
    agulha.style.left = `${50 + limitado}%`;
    agulha.style.opacity = '1';
    estado.textContent = cls.rotulo;
    centsEl.textContent = `(${c > 0 ? '+' : ''}${Math.round(c)} cents)`;
    return cls;
  }
  definir(null);
  return { el, definir };
}
