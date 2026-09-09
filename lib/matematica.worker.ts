import { resolverAvancada, type PedidoMatematico } from "./matematica-avancada";
self.onmessage = (evento: MessageEvent<{ id: number; pedido: PedidoMatematico }>) => {
  const { id, pedido } = evento.data;
  self.postMessage({ id, resposta: resolverAvancada(pedido) });
};
