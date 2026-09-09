import type { PedidoMatematico } from "./matematica-avancada";
import { resolverMatematica, type AnaliseMatematica } from "./matematica";

/** Worker isolado, limite de tempo e cache em memória; não persiste dados do aluno. */
export class MotorMatematico {
  private worker: Worker | null = null;
  private id = 0;
  private cache = new Map<string, AnaliseMatematica>();
  private pendentes = new Map<number, { concluir: (v: AnaliseMatematica) => void; timer: ReturnType<typeof setTimeout> }>();
  async resolver(pedido: PedidoMatematico): Promise<AnaliseMatematica> {
    if (pedido.operacao === "auto" && pedido.variavel === "x") {
      const simples = resolverMatematica(pedido.expressao);
      if (simples.ok) return simples;
    }
    const chave = JSON.stringify(pedido);
    const salvo = this.cache.get(chave);
    if (salvo) return salvo;
    if (!this.worker) {
      this.worker = new Worker(new URL("./matematica.worker.ts", import.meta.url));
      this.worker.onmessage = (e: MessageEvent<{ id: number; resposta: AnaliseMatematica }>) => {
        const item = this.pendentes.get(e.data.id);
        if (!item) return;
        clearTimeout(item.timer); this.pendentes.delete(e.data.id);
        item.concluir(e.data.resposta);
      };
      this.worker.onerror = () => this.encerrar("Não foi possível carregar o motor matemático.");
    }
    const id = ++this.id;
    const resposta = await new Promise<AnaliseMatematica>((concluir) => {
      const timer = setTimeout(() => this.encerrar("Este cálculo excedeu o limite de 3 segundos. Simplifique a expressão e tente novamente."), 3000);
      this.pendentes.set(id, { concluir, timer });
      this.worker!.postMessage({ id, pedido });
    });
    if (resposta.ok) {
      if (this.cache.size >= 40) this.cache.clear();
      this.cache.set(chave, resposta);
    }
    return resposta;
  }
  encerrar(motivo = "Cálculo cancelado.") {
    this.worker?.terminate(); this.worker = null;
    for (const item of this.pendentes.values()) { clearTimeout(item.timer); item.concluir({ ok: false, motivo }); }
    this.pendentes.clear(); this.cache.clear();
  }
}
