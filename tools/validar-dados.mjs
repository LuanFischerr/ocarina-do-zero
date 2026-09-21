#!/usr/bin/env node
// Confere os JSON de data/ depois que você editar à mão. Não precisa instalar nada:  node tools/validar-dados.mjs
// Sai com código 1 se achar problema (dá para usar em CI).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (nome) => {
  const caminho = fileURLToPath(new URL(`../data/${nome}`, import.meta.url));
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (e) {
    console.error(`✗ data/${nome}: ${e.message}`);
    process.exit(1);
  }
};

const problemas = [];
const avisos = [];
const ruim = (msg) => problemas.push(msg);

const dedilhados = ler('dedilhados.json');
const layout = ler('ocarina-layout.json');
const licoes = ler('licoes.json').licoes;
const tecnica = ler('tecnica.json');
const treinos = ler('treinos.json').treinos;
const musicas = ler('musicas.json');
const trilha = ler('trilha.json').passos;

// ---- dedilhados x layout ----
const furos = new Set(Object.keys(layout.furos));
const idsNotas = new Set();
const padroes = new Map();
for (const n of dedilhados.notas) {
  if (idsNotas.has(n.id)) ruim(`dedilhados: nota repetida ${n.id}`);
  idsNotas.add(n.id);
  if (!/^[A-G]#?\d$/.test(n.id)) ruim(`dedilhados: id de nota inválido "${n.id}" (use formato C5, C#5)`);
  if (!['alta', 'media', 'baixa'].includes(n.confianca)) ruim(`dedilhados ${n.id}: "confianca" deve ser alta, media ou baixa`);
  const todos = [{ nome: n.id, cobertos: n.cobertos }, ...(n.alternativas ?? []).map((a, i) => ({ nome: `${n.id} (alternativa ${i + 1})`, cobertos: a.cobertos }))];
  for (const { nome, cobertos } of todos) {
    for (const h of cobertos) if (!furos.has(h)) ruim(`dedilhados ${nome}: furo desconhecido "${h}" (furos válidos: ${[...furos].join(', ')})`);
    if (new Set(cobertos).size !== cobertos.length) ruim(`dedilhados ${nome}: furo repetido na lista`);
    const k = [...cobertos].sort().join('|');
    if (padroes.has(k)) ruim(`dedilhados: ${nome} tem o mesmo dedilhado de ${padroes.get(k)} (o app não conseguiria distinguir)`);
    padroes.set(k, nome);
  }
  for (const f of n.fontes ?? []) if (!dedilhados.fontes[f]) ruim(`dedilhados ${n.id}: fonte "${f}" não cadastrada em "fontes"`);
  if (!n.validada_na_minha_ocarina) avisos.push(n.id);
}
if (dedilhados.notas.length !== 21) avisos.push(`(informativo) a extensão Alto C tem 21 notas; aqui há ${dedilhados.notas.length}`);

// ---- lições, técnica, treinos, músicas, trilha ----
const idsLicoes = new Set(licoes.map((l) => l.id));
const idsTec = new Set(tecnica.topicos.map((t) => t.id));
const idsMus = new Set(musicas.musicas.map((m) => m.id));
for (const t of tecnica.topicos) for (const k of t.fontes) if (!tecnica.fontes[k]) ruim(`tecnica ${t.id}: fonte "${k}" não cadastrada`);
for (const s of tecnica.sintomas) if (!idsTec.has(s.topico)) ruim(`tecnica: sintoma "${s.id}" aponta para tema inexistente "${s.topico}"`);
for (const r of tecnica.rotina) for (const id of r.ref ?? []) if (!idsNotas.has(id)) ruim(`tecnica rotina "${r.id}": nota "${id}" fora da extensão`);

const checarNotas = (nome, lista) => {
  let soma = 0;
  for (const x of lista) {
    if (x.n != null && !idsNotas.has(x.n)) ruim(`${nome}: nota "${x.n}" fora da extensão da ocarina`);
    if (!(x.t > 0)) ruim(`${nome}: duração inválida (${x.t}); use um número maior que 0`);
    soma += x.t;
  }
  if (!lista.some((x) => x.n)) ruim(`${nome}: não tem nenhuma nota`);
  return soma;
};
for (const t of treinos) { if (!(t.bpm > 0)) ruim(`treino ${t.id}: bpm inválido`); checarNotas(`treino ${t.id}`, t.notas); }
for (const m of musicas.musicas) {
  checarNotas(`música ${m.id}`, m.notas);
  const seq = m.notas.filter((x) => x.n).map((x) => x.n).join(',');
  if (seq !== m.sequencia.join(',')) ruim(`música ${m.id}: "sequencia" e "notas" não batem (${m.sequencia.join(' ')} × ${seq.replaceAll(',', ' ')})`);
  if (![1, 2, 3].includes(m.nivel)) ruim(`música ${m.id}: "nivel" deve ser 1, 2 ou 3`);
  if (typeof m.verificada !== 'boolean') ruim(`música ${m.id}: "verificada" deve ser true ou false`);
  for (const f of m.fontes) if (!musicas.fontes[f]) ruim(`música ${m.id}: fonte "${f}" não cadastrada`);
}
for (const p of trilha) {
  const existe = p.tipo === 'licao' ? idsLicoes.has(p.id) : p.tipo === 'tecnica' ? idsTec.has(p.id) : p.tipo === 'musica' ? idsMus.has(p.id) : ['quiz', 'escuta', 'guiado'].includes(p.id);
  if (!existe) ruim(`trilha: passo ${p.tipo}/${p.id} não existe`);
}
for (const l of licoes) for (const e of l.exercicio.etapas) {
  if (e.tipo === 'quiz') for (const q of e.perguntas) if (!(q.correta >= 0 && q.correta < q.opcoes.length)) ruim(`lição ${l.id}: pergunta "${q.texto}" tem "correta" fora das opções`);
}

// ---- relatório ----
const naoValidadas = avisos.filter((a) => /^[A-G]#?\d$/.test(a));
console.log(`Conferidos: ${dedilhados.notas.length} notas, ${licoes.length} lições, ${tecnica.topicos.length} temas de técnica, ${treinos.length} treinos, ${musicas.musicas.length} canções, ${trilha.length} passos de trilha.`);
if (naoValidadas.length) console.log(`ℹ ${naoValidadas.length} de ${dedilhados.notas.length} notas ainda sem "validada_na_minha_ocarina": true.`);
if (problemas.length) {
  console.error(`\n✗ ${problemas.length} problema(s):`);
  problemas.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('✓ Tudo consistente.');
