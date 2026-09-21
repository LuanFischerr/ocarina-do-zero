# Ocarina do Zero

Sistema visual e interativo para aprender a tocar **ocarina de 12 furos (afinação Alto C)** e, ao mesmo tempo, **música básica**, do zero absoluto. Feito em português do Brasil, em HTML, CSS e JavaScript puros: sem framework, sem build, sem dependências.

**Site no ar:** <https://luanfischerr.github.io/ocarina-do-zero/>

## O que tem

| Módulo | O que faz |
|---|---|
| **Fundamentos** | 5 mini-lições (som e altura, as 7 notas com Dó Ré Mi = C D E, oitavas e ♯/♭, ritmo, pauta), cada uma com widgets interativos e um mini-exercício |
| **Ocarina** | SVG da ocarina (traçado sobre a sua foto): escolha uma nota e veja os furos e ouça o som; ou toque nos furos e o app diz a nota |
| **Tabela** | os 21 dedilhados (Lá 4 a Fá 6, com sustenidos e bemóis), miniaturas, alternativas, fontes e divergências |
| **Técnica** | 7 temas com ilustrações originais: postura, cobrir furos sem vazar, sopro, articulação (tu/du/lu), respiração, aquecimento e erros comuns |
| **Prática** | quiz "Qual nota é essa?" (com revisão espaçada), **modo escuta** com microfone e **modo guiado** com avaliação e controle de andamento |
| **Repertório** | as 12 canções de *Ocarina of Time*, do mais fácil ao mais difícil, com dedilhados, referência sintetizada e modo guiado |
| **Progresso** | trilha sugerida, domínio por nota, dias de estudo e backup (exportar/importar) |

Tudo funciona no celular e no notebook, com tema claro/escuro automático, contraste acessível e animações que respeitam `prefers-reduced-motion`.

## Rodar localmente

O app usa módulos ES e `fetch` nos arquivos JSON, então **não abre por `file://`**. Use qualquer servidor estático:

```bash
npx serve .
```

ou, com Python instalado:

```bash
python -m http.server 5173
```

Depois abra o endereço mostrado (por exemplo `http://localhost:5173`). No celular, use o IP do computador na mesma rede, mas lembre que o **microfone só funciona em `https` ou `localhost`** (veja abaixo).

Para conferir os dados depois de editar os JSON:

```bash
node tools/validar-dados.mjs
```

## Publicar no GitHub Pages

O projeto já usa caminhos relativos e rotas por hash (`#/ocarina`), então funciona em subpasta e sem configuração extra.

1. Crie um repositório **público** (o Pages gratuito exige) e envie o código:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/ocarina-do-zero.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**.
   Pela linha de comando: `gh api -X POST repos/SEU-USUARIO/ocarina-do-zero/pages -f "source[branch]=main" -f "source[path]=/"`.
3. Em cerca de um minuto o site fica em `https://SEU-USUARIO.github.io/ocarina-do-zero/`.
4. Para atualizar, basta um `git push`.

O site sai em **HTTPS**, o que é exigido pelo microfone.

## Estrutura

```
index.html
css/          tokens.css (design tokens) · base.css · componentes.css · fundamentos.css
              tecnica.css · pratica.css · repertorio.css · progresso.css
js/           main.js (roteador por hash, tema) · estado.js (localStorage) · progresso.js
js/audio/     sintese.js (Web Audio) · pitch.js (autocorrelação) · microfone.js (getUserMedia)
js/ocarina/   dedilhados.js · ocarina-svg.js · teclado.js · medidor.js
js/fundamentos/  widgets.js · exercicios.js · ritmo.js · pauta.js
js/tecnica/   widgets.js · ilustracoes.js (SVG originais)
js/pratica/   quiz.js · escuta.js · guiado.js · painel-mic.js
js/modulos/   inicio · fundamentos · ocarina · tabela · tecnica · pratica · repertorio · progresso
data/         JSON editáveis (abaixo)
tools/        validar-dados.mjs
referencias/  fotos da sua ocarina
```

## Dados editáveis (`data/`)

Toda a "verdade" musical está em JSON, separada da lógica. Edite à vontade e rode `node tools/validar-dados.mjs`.

| Arquivo | O que guarda |
|---|---|
| `dedilhados.json` | para cada nota, a lista de furos **cobertos**; `confianca`, `fontes`, `alternativas` e `validada_na_minha_ocarina` |
| `ocarina-layout.json` | posição e tamanho de cada furo, qual dedo/mão é cada um e o contorno do corpo |
| `licoes.json` | textos e perguntas das lições de Fundamentos |
| `tecnica.json` | textos, rotina de aquecimento e sintomas do diagnóstico |
| `treinos.json` | exercícios do modo guiado (`n` = nota ou `null` para pausa; `t` = duração em tempos) |
| `musicas.json` | repertório, com `verificada`, `fontes` e `ritmo_verificado` |
| `trilha.json` | ordem da trilha sugerida |

Exemplo: depois de testar o Ré 5 na sua ocarina, em `dedilhados.json` troque `"validada_na_minha_ocarina": false` por `true` na nota `D5`. Se o seu modelo usa outro dedilhado, edite a lista `cobertos`.

## O que precisa ser conferido com a sua ocarina

Os dedilhados vieram de fontes (não da sua ocarina), e a identificação dos furos foi **inferida** de fotos. **Nada disto foi testado numa ocarina de verdade.** Confira nesta ordem:

1. **Furos e dedos:** cubra os 8 furos dos dedos e os 2 polegares, com os sub-furos abertos: deve soar **Dó 5**. Solte só o mínimo direito: **Ré 5**. Se não bater, ajuste `mao`/`dedo` em `ocarina-layout.json`.
2. **Sub-furos A e B:** Lá 4 (cobrir os dois), Lá♯4 (só o A) e Si 4 (só o B). Se Lá♯4 e Si 4 saírem trocados, inverta `sub_a` e `sub_b` no layout.
3. **Polegares:** o **esquerdo** levanta primeiro (Ré 6) e o **direito** depois (Mi 6). Seis canções do repertório usam o Ré 6.
4. **Ré♯5 / Mi♭5:** as fontes divergem. O app mostra a versão do Imperial City e guarda a do Playsoloist como alternativa. Dó♯6 e Ré♯6 também têm variações citadas.
5. **Repertório:** a Canção da Epona teve divergência entre fontes (adotado Cima-Esquerda-Direita, isto é, Ré6 Si5 Lá5). O **ritmo** das canções é simplificado, não o original.
6. **Modo escuta e guiado:** a detecção foi testada só com sinais sintéticos. Confira com o som real da ocarina se a avaliação está justa; os limites (60 cents de tolerância, 45% de leituras corretas) estão em `js/pratica/guiado.js`.

## Fontes consultadas

- **Dedilhados:** [Playsoloist](https://playsoloist.com/ocarina/finger-chart) (tabela em texto) e [Imperial City Ocarina](https://www.imperialcityocarina.com/images/cache/ac-12-hole-fingering-chart.pdf) (PDF ilustrado). As duas coincidem em 20 das 21 notas. Divergem no Ré♯5. Outras fontes (Pure Ocarinas, fingeringchart.org) só confirmaram a ordem das notas naturais.
- **Técnica:** [Pure Ocarinas](https://pureocarinas.com/how-to-play-ocarina), [Songbird Ocarina](https://songbirdocarina.zendesk.com/hc/en-us/articles/203542580-Using-Proper-Breath-Pressure) e [STL Ocarina](https://www.stlocarina.com/blogs/news/ocarina-care-instructions). Detalhes por tema no próprio app.
- **Repertório:** sequências de botões em [Thonky](https://www.thonky.com/ocarina-of-time/ocarina-songs) e [Gamertag Mythras](https://gamertagmythras.com/blog/zelda-ocarina-of-time/ocarina-of-time-songs-guide); notas na ocarina de 12 furos em [PlayByFingering](https://www.playbyfingering.com/learn/zelda-ocarina-songs).

## Microfone e privacidade

- O navegador só pede permissão quando você toca em **Ativar microfone**.
- O áudio é analisado **no seu aparelho**, em tempo real (autocorrelação normalizada). **Nada é gravado nem enviado.**
- Se você negar, o app explica o motivo e segue funcionando: o quiz e as lições não dependem do microfone, e o modo guiado roda sem avaliação.
- Requer contexto seguro: `https` (GitHub Pages) ou `localhost`.
- Use fones quando o app tocar sons, para não voltarem pelo microfone.

O progresso fica no `localStorage` do navegador (prefixo `ocarina-do-zero:`). Use **Progresso → Exportar** para levar para outro aparelho.

## Direitos autorais

O repositório usa **apenas notas sintetizadas no navegador e arte original**: nenhum áudio, sprite ou imagem da Nintendo. As melodias e os nomes das canções de *The Legend of Zelda: Ocarina of Time* pertencem aos seus titulares; o app guarda só as sequências curtas de notas, para estudo. Materiais de terceiros usados apenas para conferência (como o PDF do Imperial City) ficam em `referencias/externas/`, fora do git.

## Limitações conhecidas

- O contorno do corpo da ocarina foi traçado à mão sobre a foto.
- O ritmo do repertório é simplificado.
- O modo guiado depende de o navegador liberar o microfone e de um ambiente razoavelmente silencioso.
- O progresso não sincroniza sozinho entre aparelhos (há backup manual).
- Ainda não há licença de código definida (veja "Licença" abaixo).

## Licença

Este repositório ainda **não tem licença**. Escolha uma (por exemplo MIT) se quiser permitir reuso do código. Os textos e ilustrações do app são originais deste projeto.
