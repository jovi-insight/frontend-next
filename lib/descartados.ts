"use client";

import { gravarLocalStorage } from "./use-local-storage";

/**
 * Formato legado da lixeira local.
 *
 * Mantido somente para migrar ids gravados por versões antigas do PWA para a
 * lixeira compartilhada do backend. Fluxos novos não devem gravar aqui.
 */
export const CHAVE_LIXEIRA = "jovi_descartados";

export function lerDescartados(bruto: string): Set<string> {
  try {
    const lista = JSON.parse(bruto || "[]");
    return new Set(Array.isArray(lista) ? (lista as string[]) : []);
  } catch {
    return new Set();
  }
}

function gravar(ids: Set<string>) {
  gravarLocalStorage(CHAVE_LIXEIRA, JSON.stringify([...ids]));
}

export function descartar(atuais: Set<string>, ids: string[]) {
  const novo = new Set(atuais);
  ids.forEach((id) => novo.add(id));
  gravar(novo);
}

export function restaurar(atuais: Set<string>, ids: string[]) {
  const novo = new Set(atuais);
  ids.forEach((id) => novo.delete(id));
  gravar(novo);
}

export function esvaziar() {
  gravar(new Set());
}
