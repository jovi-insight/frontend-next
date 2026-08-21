"use client";

import { useSyncExternalStore } from "react";

/**
 * Leitura reativa do localStorage, sem o padrão `useEffect(() => setX(...))`
 * que dispara uma segunda renderização em cascata a cada montagem.
 *
 * localStorage é estado externo ao React, e useSyncExternalStore existe para
 * isso: aceita um valor diferente no servidor (onde ele não existe) sem
 * quebrar a hidratação.
 */

// O evento `storage` do navegador só avisa OUTRAS abas. Para a aba que grava,
// a notificação tem que ser nossa — daí este conjunto de inscritos.
const inscritos = new Set<() => void>();

function inscrever(aoMudar: () => void) {
  inscritos.add(aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    inscritos.delete(aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

/** Grava e avisa todo mundo que lê a chave, inclusive nesta aba. */
export function gravarLocalStorage(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* modo privado bloqueia a escrita */
  }
  inscritos.forEach((aoMudar) => aoMudar());
}

export function removerLocalStorage(chave: string) {
  try {
    localStorage.removeItem(chave);
  } catch {
    /* modo privado */
  }
  inscritos.forEach((aoMudar) => aoMudar());
}

export function useLocalStorage(chave: string, padrao = ""): string {
  return useSyncExternalStore(
    inscrever,
    () => localStorage.getItem(chave) ?? padrao,
    () => padrao,
  );
}
