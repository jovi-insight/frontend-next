"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { CHAVE_PERFIL, lerPerfis } from "@/lib/perfil";

/**
 * Espelha os perfis escolhidos em <body data-perfil="a b">, que é como o
 * jovi.css aplica zoom, contraste e espaçamento (seletores `~=`).
 *
 * Fica no layout raiz de propósito: antes isso só acontecia na tela de
 * Ajustes, então o perfil "funcionava" ali e sumia em todas as outras
 * páginas — que são justamente onde ele precisa valer.
 */
export default function AplicaPerfil() {
  const salvo = useLocalStorage(CHAVE_PERFIL);
  const perfis = lerPerfis(salvo).join(" ");

  useEffect(() => {
    document.body.dataset.perfil = perfis;
  }, [perfis]);

  return null;
}
