"use client";

import { gravarLocalStorage } from "./use-local-storage";

/**
 * Lixeira local.
 *
 * O backend não expõe DELETE /conteudo — só dá para apagar uma pasta inteira,
 * o que levaria junto tudo que está dentro. Então "apagar" aqui significa
 * esconder da galeria neste navegador: o documento continua no banco e pode
 * ser restaurado a qualquer momento.
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
