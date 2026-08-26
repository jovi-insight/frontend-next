import assert from "node:assert";
import {
  criarPagina, marcarTexto, marcarFalha, removerPagina, textoDaAula,
} from "../.teste-build/paginas-aula.js";

// Uma página nasce "pendente": a OCR só roda ao concluir a aula.
{
  const p = criarPagina("data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BB");
  assert.strictEqual(p.estado, "pendente");
  assert.strictEqual(p.texto, null);
  assert.ok(p.id, "precisa de id para casar a resposta da OCR com a página");
}

// Dois disparos seguidos não podem gerar o mesmo id, senão a OCR de uma
// sobrescreveria o texto da outra.
{
  const a = criarPagina("x", "y");
  const b = criarPagina("x", "y");
  assert.notStrictEqual(a.id, b.id);
}

// A ordem de captura é a ordem do texto — mesmo se a OCR voltar fora de ordem.
{
  let ps = [criarPagina("i1", "m1"), criarPagina("i2", "m2"), criarPagina("i3", "m3")];
  ps = marcarTexto(ps, ps[2].id, "terceira");
  ps = marcarTexto(ps, ps[0].id, "primeira");
  ps = marcarTexto(ps, ps[1].id, "segunda");
  assert.strictEqual(
    textoDaAula(ps),
    "[Página 1]\nprimeira\n\n[Página 2]\nsegunda\n\n[Página 3]\nterceira",
  );
}

// Página que a OCR não leu entra marcada, em vez de sumir sem aviso.
{
  let ps = [criarPagina("i1", "m1"), criarPagina("i2", "m2")];
  ps = marcarTexto(ps, ps[0].id, "deu certo");
  ps = marcarFalha(ps, ps[1].id);
  assert.strictEqual(ps[1].estado, "falhou");
  assert.strictEqual(
    textoDaAula(ps),
    "[Página 1]\ndeu certo\n\n[Página 2] (não foi possível ler)",
  );
}

// Descartar a foto tremida renumera as seguintes.
{
  let ps = [criarPagina("i1", "m1"), criarPagina("i2", "m2"), criarPagina("i3", "m3")];
  ps = marcarTexto(ps, ps[0].id, "a");
  ps = marcarTexto(ps, ps[1].id, "tremida");
  ps = marcarTexto(ps, ps[2].id, "c");
  ps = removerPagina(ps, ps[1].id);
  assert.strictEqual(ps.length, 2);
  assert.strictEqual(textoDaAula(ps), "[Página 1]\na\n\n[Página 2]\nc");
}

// Resposta atrasada de uma página já removida não pode ressuscitá-la.
{
  let ps = [criarPagina("i1", "m1")];
  const idRemovido = ps[0].id;
  ps = removerPagina(ps, idRemovido);
  ps = marcarTexto(ps, idRemovido, "chegou tarde");
  assert.strictEqual(ps.length, 0);
}

// Sem página nenhuma, o texto é vazio (o botão de concluir fica desabilitado).
{
  assert.strictEqual(textoDaAula([]), "");
}

// As funções não mutam o array recebido — o React precisa de referência nova.
{
  const original = [criarPagina("i1", "m1")];
  const depois = marcarTexto(original, original[0].id, "x");
  assert.notStrictEqual(original, depois);
  assert.strictEqual(original[0].texto, null, "o array original foi mutado");
}

console.log("paginas-aula.test.mjs OK");
