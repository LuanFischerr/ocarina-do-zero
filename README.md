# Ocarina do Zero

Sistema visual e interativo para aprender ocarina de 12 furos (afinação **Alto C**) e música básica, em português do Brasil.
HTML/CSS/JS puro, sem build. Funciona no GitHub Pages.

> Status: **etapa 5** (ocarina + dedilhados + tabela + Fundamentos + Técnica + Prática com microfone). Restam Repertório Zelda e Progresso.

## Rodar localmente

Os módulos ES e o `fetch` dos JSON exigem um servidor (abrir o `index.html` direto por `file://` não funciona):

```bash
npx serve .
```

ou, com Python instalado:

```bash
python -m http.server 5173
```

Depois abra `http://localhost:5173` (ou a porta indicada).

## Estrutura

```
index.html
css/        tokens.css (design tokens) · base.css · componentes.css
js/         main.js (roteador por hash) · estado.js (localStorage)
js/audio/   sintese.js (Web Audio) · pitch.js (autocorrelação) · microfone.js (getUserMedia)
js/pratica/  quiz.js · escuta.js · guiado.js · painel-mic.js
js/fundamentos/ widgets.js · exercicios.js · ritmo.js · pauta.js
js/tecnica/  widgets.js · ilustracoes.js (SVG originais)
js/progresso.js (progresso das lições)
js/ocarina/ dedilhados.js · ocarina-svg.js · teclado.js · medidor.js
js/modulos/ inicio.js · fundamentos.js · tecnica.js · pratica.js · ocarina.js · tabela.js
data/       dedilhados.json · ocarina-layout.json · licoes.json · tecnica.json · treinos.json   ← editáveis
referencias/ fotos da ocarina
```

## Dados editáveis

- `data/dedilhados.json`: lista de furos **cobertos** por nota. Cada nota tem `confianca`, `fontes`, `observacao`, `alternativas` e `validada_na_minha_ocarina`. Depois de testar uma nota na sua ocarina, marque `true`.
- `data/ocarina-layout.json`: posição/tamanho de cada furo e o contorno do corpo. Se algum furo estiver associado ao dedo errado, ajuste `mao`/`dedo`/`rotulo` aqui.

## Onde há incerteza (validar com a ocarina em mãos)

Veja `divergencias` em `data/dedilhados.json` e `incerto` em `data/ocarina-layout.json`.

## Microfone (modo escuta e guiado)

O microfone só funciona em contexto seguro: **https** (GitHub Pages) ou **localhost**. O navegador pede permissão só quando você toca em "Ativar microfone". O áudio é analisado no próprio aparelho (autocorrelação normalizada) e **não é gravado nem enviado**. Se você negar, tudo continua funcionando sem avaliação automática.
