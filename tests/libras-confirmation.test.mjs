import assert from "node:assert/strict";

let criarConfirmadorLibras;
try {
  ({ criarConfirmadorLibras } = await import("../.teste-build/libras-confirmation.js"));
} catch {
  // RED: o módulo ainda não existe antes da implementação.
}

assert.equal(
  typeof criarConfirmadorLibras,
  "function",
  "o filtro de confirmação de Libras ainda não foi implementado",
);

const confirmada = (letter, confidence, dynamic = false) => ({
  status: "confirmado",
  letter,
  confidence,
  dynamic,
});
const incerta = { status: "incerto" };

{
  const filtro = criarConfirmadorLibras();
  assert.deepEqual(filtro.processar(confirmada("A", 0.96), 0), {
    visivel: null,
    confianca: 0,
    registrar: null,
  });
  assert.deepEqual(filtro.processar(confirmada("A", 0.94), 599), {
    visivel: null,
    confianca: 0,
    registrar: null,
  });
  assert.deepEqual(filtro.processar(confirmada("A", 0.95), 600), {
    visivel: "A",
    confianca: 0.95,
    registrar: "A",
  });
}

{
  const filtro = criarConfirmadorLibras();
  assert.deepEqual(filtro.processar({ status: "estabilizando", letter: "B", confidence: 0.98 }, 0), {
    visivel: null,
    confianca: 0,
    registrar: null,
  });
  filtro.processar(confirmada("B", 0.89), 100);
  assert.deepEqual(filtro.processar(confirmada("B", 0.89), 700), {
    visivel: null,
    confianca: 0,
    registrar: null,
  });
}

{
  const filtro = criarConfirmadorLibras();
  filtro.processar(confirmada("C", 0.96), 0);
  filtro.processar(confirmada("C", 0.96), 600);

  filtro.processar(incerta, 1000);
  filtro.processar(confirmada("D", 0.97), 1001);
  filtro.processar(confirmada("D", 0.97), 1601);
  assert.deepEqual(filtro.processar(confirmada("D", 0.97), 2201), {
    visivel: null,
    confianca: 0,
    registrar: null,
  });
}

{
  const filtro = criarConfirmadorLibras();
  filtro.processar(confirmada("C", 0.96), 0);
  filtro.processar(confirmada("C", 0.96), 600);
  filtro.processar(incerta, 1000);
  filtro.processar(incerta, 1300);
  filtro.processar(confirmada("D", 0.97), 1301);
  assert.deepEqual(filtro.processar(confirmada("D", 0.97), 1901), {
    visivel: "D",
    confianca: 0.97,
    registrar: "D",
  });
}

{
  const filtro = criarConfirmadorLibras();
  assert.deepEqual(filtro.processar(confirmada("J", 0.87, true), 0), {
    visivel: "J",
    confianca: 0.87,
    registrar: "J",
  });
}

console.log("libras-confirmation.test.mjs: ok");
