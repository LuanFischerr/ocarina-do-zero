// Ilustrações originais (SVG) da Técnica. Só usam currentColor e variáveis de tema, então funcionam no claro e no escuro.

const fig = (viewBox, corpo, titulo) =>
  `<svg viewBox="${viewBox}" class="ilus" role="img" aria-label="${titulo}">${corpo}</svg>`;

/** Postura vista de lado: coluna reta, ombros soltos, ocarina vai até a boca. */
function postura() {
  const c = 'stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const rot = (x, y, txt, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="ilus-txt">${txt}</text>`;
  const guia = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" class="ilus-guia"/>`;
  return fig('-100 0 660 330', `
    <rect x="-100" y="0" width="660" height="330" rx="14" fill="var(--superficie-2)"/>
    <line x1="-20" y1="300" x2="500" y2="300" stroke="var(--borda-forte)" stroke-width="3"/>
    <!-- coluna reta (guia) -->
    <line x1="170" y1="30" x2="170" y2="300" stroke="var(--verde)" stroke-width="2.4" stroke-dasharray="7 7"/>
    <!-- pernas -->
    <path d="M170 220 L158 300 M170 220 L196 300" ${c}/>
    <!-- tronco -->
    <path d="M170 105 L170 220" ${c} stroke-width="16" opacity=".85"/>
    <!-- pescoço e cabeça (erguida, olhando à frente) -->
    <path d="M170 105 L170 84" ${c} stroke-width="9"/>
    <circle cx="172" cy="56" r="27" fill="var(--superficie)" stroke="currentColor" stroke-width="3"/>
    <path d="M196 52 L206 58 L196 62" ${c} stroke-width="2.4"/>
    <!-- braço: ombro -> cotovelo (perto do corpo) -> mãos na ocarina -->
    <path d="M170 116 L188 176 L242 96" ${c} stroke-width="9"/>
    <circle cx="170" cy="116" r="7" fill="var(--ouro)"/>
    <circle cx="188" cy="176" r="7" fill="var(--ouro)"/>
    <!-- ocarina chegando à boca -->
    <path d="M204 66 C 218 70, 222 76, 236 82 C 262 90, 282 82, 290 96 C 284 112, 258 118, 238 104 C 228 98, 218 90, 206 80 Z" fill="var(--oc-2)" stroke="var(--oc-3)" stroke-width="2.5"/>
    <circle cx="256" cy="94" r="3.4" fill="var(--furo-vazio)"/><circle cx="270" cy="96" r="3.4" fill="var(--furo-vazio)"/><circle cx="246" cy="98" r="3" fill="var(--furo-vazio)"/>
    <!-- rótulos -->
    ${guia(200, 40, 320, 34)}${rot(326, 38, 'Cabeça erguida, olhar à frente')}
    ${guia(158, 112, 92, 138)}${rot(86, 142, 'Ombros soltos', 'end')}
    ${guia(188, 182, 296, 214)}${rot(302, 218, 'Cotovelos soltos, perto do corpo')}
    ${guia(170, 260, 92, 262)}${rot(86, 266, 'Coluna reta', 'end')}
    ${guia(292, 100, 372, 128)}${rot(378, 132, 'A ocarina sobe até a boca')}
    ${rot(378, 152, '(você não desce a cabeça)')}
  `, 'Pessoa de lado, em pé, com coluna reta, ombros soltos, cabeça erguida e a ocarina levada até a boca');
}

/** Três painéis em corte: almofada centralizada (certo) x ponta do dedo x furo só pela metade. */
function almofada() {
  const painel = (x, titulo, ok, dedo, ar) => `
    <g transform="translate(${x} 0)">
      <rect x="0" y="0" width="170" height="250" rx="12" fill="var(--superficie-2)" stroke="${ok ? 'var(--verde)' : 'var(--vermelho)'}" stroke-width="3"/>
      <!-- parede da ocarina com o furo (corte lateral) -->
      <rect x="10" y="150" width="60" height="30" fill="var(--oc-2)"/><rect x="100" y="150" width="60" height="30" fill="var(--oc-2)"/>
      <rect x="70" y="150" width="30" height="30" fill="var(--furo-vazio)"/>
      ${dedo}${ar}
      <text x="85" y="34" text-anchor="middle" class="ilus-tit ${ok ? 'ok' : 'erro'}">${ok ? '✓' : '✗'} ${titulo[0]}</text>
      <text x="85" y="56" text-anchor="middle" class="ilus-txt-pq">${titulo[1]}</text>
      <text x="85" y="212" text-anchor="middle" class="ilus-txt-pq">${titulo[2]}</text>
    </g>`;
  const pele = 'fill="var(--dedo)" stroke="var(--dedo-borda)" stroke-width="3"';
  const setas = (xs) => xs.map((x) => `<path d="M${x} 168 q -8 -18 -22 -22 M${x} 168 q 8 -18 22 -22" fill="none" stroke="var(--vermelho)" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3 5"/>`).join('');
  return fig('0 0 550 250',
    painel(0, ['Certo', 'centro da almofada', 'sela o furo por inteiro'], true,
      `<path d="M52 150 C 52 100, 118 100, 118 150 Z" ${pele}/><line x1="85" y1="112" x2="85" y2="148" stroke="var(--dedo-borda)" stroke-width="2" stroke-dasharray="3 4"/>`, '') +
    painel(190, ['Errado', 'só a ponta do dedo', 'sobra fresta: vaza ar'], false,
      `<path d="M74 150 C 74 112, 96 112, 96 150 Z" ${pele}/>`, `<path d="M62 168 q -8 -18 -22 -22 M108 168 q 8 -18 22 -22" fill="none" stroke="var(--vermelho)" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3 5"/>`) +
    painel(380, ['Errado', 'furo pela metade', 'desafina e chia'], false,
      `<path d="M92 150 C 92 100, 158 100, 158 150 Z" ${pele}/>`, setas([78])),
    'Três desenhos em corte mostrando o dedo sobre o furo: certo com o centro da almofada; errado só com a ponta do dedo; errado com o furo coberto pela metade');
}

/** Corte do bocal: por onde o ar passa e onde NÃO mexer. */
function bocal() {
  return fig('0 0 560 300', `
    <rect x="0" y="0" width="560" height="300" rx="14" fill="var(--superficie-2)"/>
    <!-- corpo (câmara) -->
    <path d="M250 60 C 330 40, 470 50, 520 110 C 545 150, 520 230, 430 250 C 350 266, 280 240, 250 200 Z" fill="var(--oc-2)" stroke="var(--oc-3)" stroke-width="3"/>
    <!-- bocal e canal de ar -->
    <path d="M40 132 L40 168 L210 176 L210 124 Z" fill="var(--oc-2)" stroke="var(--oc-3)" stroke-width="3"/>
    <path d="M40 142 L210 138 L210 162 L40 158 Z" fill="var(--furo-vazio)"/>
    <!-- janela e borda -->
    <path d="M210 124 L250 118 L250 132 L226 138" fill="none" stroke="var(--dedo-mudou)" stroke-width="4" stroke-linecap="round"/>
    <rect x="210" y="98" width="44" height="26" rx="4" fill="none" stroke="var(--vermelho)" stroke-width="3" stroke-dasharray="6 5"/>
    <!-- caminho do ar -->
    <path d="M18 150 L226 150 C 246 150, 252 134, 270 132 C 340 128, 400 150, 400 150" fill="none" stroke="var(--mao-esq)" stroke-width="4" stroke-dasharray="9 7" stroke-linecap="round"/>
    <!-- lábios e dentes -->
    <path d="M14 128 C 30 122, 30 138, 14 140 M14 160 C 30 162, 30 178, 14 172" fill="none" stroke="var(--ouro)" stroke-width="5" stroke-linecap="round"/>
    <rect x="-2" y="100" width="10" height="16" rx="2" fill="var(--tinta-suave)"/><rect x="-2" y="184" width="10" height="16" rx="2" fill="var(--tinta-suave)"/>
    <!-- rótulos -->
    <text x="40" y="222" class="ilus-txt">Bocal: só encosta nos lábios</text>
    <text x="40" y="244" class="ilus-txt-pq">(dentes longe; lábios como para dizer &quot;bu&quot;)</text>
    <text x="222" y="80" text-anchor="middle" class="ilus-txt erro-txt">Janela: nunca cubra</text>
    <text x="222" y="278" text-anchor="middle" class="ilus-txt-pq">Canal e borda: não raspe nem enfie nada</text>
    <text x="14" y="40" class="ilus-txt-pq" fill="var(--mao-esq)">→ ar entra suave e constante</text>
    <text x="380" y="215" text-anchor="middle" class="ilus-txt" fill="#fff">corpo (câmara)</text>
  `, 'Corte do bocal da ocarina mostrando o caminho do ar, a janela que não deve ser coberta e a posição dos lábios');
}

export const ILUSTRACOES = { postura, almofada, bocal };
