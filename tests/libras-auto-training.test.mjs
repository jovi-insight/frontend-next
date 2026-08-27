import assert from "node:assert/strict";
import { descreverAtualizacaoAutomatica } from "../.teste-build/libras-auto-training.js";

assert.deepEqual(descreverAtualizacaoAutomatica(undefined), {
  titulo: "Atualização automática ativa",
  detalhe: "Salve uma letra e continue coletando; o INSIGHT atualiza a rede em segundo plano.",
});

assert.deepEqual(
  descreverAtualizacaoAutomatica({
    status: "waiting-for-classes",
    ready_classes: ["A"],
    minimum_classes: 2,
  }),
  {
    titulo: "Amostras salvas",
    detalhe: "Cadastre mais uma letra; depois disso a rede será atualizada automaticamente.",
  },
);

assert.deepEqual(
  descreverAtualizacaoAutomatica({ status: "queued", ready_classes: ["A", "B"] }),
  {
    titulo: "Rede atualizando em segundo plano",
    detalhe: "Pode cadastrar a próxima letra agora. O modelo ativo continua funcionando durante a atualização.",
  },
);

assert.deepEqual(
  descreverAtualizacaoAutomatica({
    status: "scheduled",
    active_job_id: "job-1",
    ready_classes: ["A", "B", "C"],
  }),
  {
    titulo: "Nova atualização agendada",
    detalhe: "Pode continuar coletando. As novas amostras entrarão automaticamente no próximo modelo.",
  },
);

assert.deepEqual(descreverAtualizacaoAutomatica({ status: "unchanged" }), {
  titulo: "Nenhuma amostra nova",
  detalhe: "Essa rodada já estava salva; você pode repetir a letra ou escolher outra.",
});

console.log("libras-auto-training.test.mjs: ok");
