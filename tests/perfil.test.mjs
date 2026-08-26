import assert from "node:assert";

// O módulo grava no localStorage; em Node ele não existe.
const armazem = new Map();
globalThis.localStorage = {
  getItem: (k) => armazem.get(k) ?? null,
  setItem: (k, v) => armazem.set(k, String(v)),
  removeItem: (k) => armazem.delete(k),
};

const { lerPerfis, temPerfil, alternarPerfil, gravarPerfis, CHAVE_PERFIL } = await import(
  "../.teste-build/perfil.js"
);

// Valor antigo, de quando a escolha era única, continua valendo.
assert.deepStrictEqual(lerPerfis("surdo"), ["surdo"]);
// "padrao" nunca foi um perfil de verdade: é a ausência de adaptações.
assert.deepStrictEqual(lerPerfis("padrao"), []);
assert.deepStrictEqual(lerPerfis(null), []);
assert.deepStrictEqual(lerPerfis("inventado"), []);

// Vários perfis ao mesmo tempo — o ponto da mudança.
assert.deepStrictEqual(lerPerfis("surdo baixa-visao"), ["surdo", "baixa-visao"]);
assert.strictEqual(temPerfil("surdo baixa-visao", "baixa-visao"), true);
assert.strictEqual(temPerfil("surdo", "dislexia-tdah"), false);

// Ligar um perfil preserva os outros; desligar tira só ele.
{
  let perfis = alternarPerfil([], "surdo");
  assert.deepStrictEqual(perfis, ["surdo"]);
  perfis = alternarPerfil(perfis, "baixa-visao");
  assert.deepStrictEqual(perfis, ["surdo", "baixa-visao"]);
  perfis = alternarPerfil(perfis, "surdo");
  assert.deepStrictEqual(perfis, ["baixa-visao"]);
}

// O que vai para o localStorage é o que o seletor `~=` do CSS sabe casar.
gravarPerfis(["surdo", "dislexia-tdah"]);
assert.strictEqual(armazem.get(CHAVE_PERFIL), "surdo dislexia-tdah");
// E volta como lista, fechando o ciclo gravar → ler.
assert.deepStrictEqual(lerPerfis(armazem.get(CHAVE_PERFIL)), ["surdo", "dislexia-tdah"]);

console.log("perfil.test.mjs OK");
