"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { CHAVE_PERFIL, PERFIS, type PerfilId } from "@/lib/perfil";

/**
 * Espelha o perfil escolhido em <body data-perfil="...">, que é como o
 * jovi.css aplica zoom, contraste e espaçamento.
 *
 * Fica no layout raiz de propósito: antes isso só acontecia na tela de
 * Ajustes, então o perfil "funcionava" ali e sumia em todas as outras
 * páginas — que são justamente onde ele precisa valer.
 */
export default function AplicaPerfil() {
  const salvo = useLocalStorage(CHAVE_PERFIL, "padrao");
  const perfil: PerfilId = PERFIS.some((p) => p.id === salvo) ? (salvo as PerfilId) : "padrao";

  useEffect(() => {
    document.body.dataset.perfil = perfil;
  }, [perfil]);

  return null;
}
