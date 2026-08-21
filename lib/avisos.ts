"use client";

import { useSyncExternalStore } from "react";

/**
 * Avisos do app (toasts). Porte do `showToast` de frontend/js/ui-utils.js.
 *
 * Store fora do React em vez de Context: assim `avisar()` funciona de dentro
 * de um catch, de um callback de MediaRecorder ou de qualquer lugar que não
 * seja componente — sem prop drilling e sem provider embrulhando a árvore.
 */

export type TipoAviso = "info" | "sucesso" | "erro";
export type Aviso = { id: number; texto: string; tipo: TipoAviso };

const DURACAO: Record<TipoAviso, number> = {
  // Erro fica mais tempo: costuma trazer instrução do que fazer a seguir.
  erro: 6000,
  sucesso: 3000,
  info: 4000,
};

let avisos: Aviso[] = [];
let proximoId = 1;
const inscritos = new Set<() => void>();

function notificar() {
  inscritos.forEach((f) => f());
}

export function avisar(texto: string, tipo: TipoAviso = "info") {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return;

  // Repetir a mesma mensagem empilharia cópias na tela: renova a de cima.
  if (avisos.at(-1)?.texto === limpo) {
    dispensar(avisos.at(-1)!.id);
  }

  const aviso: Aviso = { id: proximoId++, texto: limpo, tipo };
  // No máximo três: acima disso a pilha cobre a tela no celular.
  avisos = [...avisos, aviso].slice(-3);
  notificar();
  setTimeout(() => dispensar(aviso.id), DURACAO[tipo]);
}

export function dispensar(id: number) {
  const antes = avisos.length;
  avisos = avisos.filter((a) => a.id !== id);
  if (avisos.length !== antes) notificar();
}

function inscrever(aoMudar: () => void) {
  inscritos.add(aoMudar);
  return () => {
    inscritos.delete(aoMudar);
  };
}

const vazio: Aviso[] = [];

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    inscrever,
    () => avisos,
    () => vazio, // no servidor nunca há aviso pendente
  );
}
