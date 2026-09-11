"use client";

import { useEffect } from "react";
import { type LembreteCalendarioPendente } from "@/lib/api";
import { consultarLembretes, confirmarLembrete } from "@/lib/calendario-notificacoes";
import { avisar } from "@/lib/avisos";
import { rotuloLembrete, rotuloTipoEvento } from "@/lib/calendario";

function descricao(lembrete: LembreteCalendarioPendente): string {
  const data = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${lembrete.data}T12:00:00`),
  );
  const hora = lembrete.hora ? ` às ${lembrete.hora.slice(0, 5)}` : "";
  return `${rotuloTipoEvento(lembrete.tipo)} em ${data}${hora}${
    lembrete.materia ? ` · ${lembrete.materia}` : ""
  }`;
}

async function notificarNoAparelho(lembrete: LembreteCalendarioPendente) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro || await registro.pushManager?.getSubscription()) return;
  await registro.showNotification(`Lembrete: ${lembrete.titulo}`, {
    body: `${descricao(lembrete)} · ${rotuloLembrete(lembrete.minutos_antes)}`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: `calendario-${lembrete.evento_id}-${lembrete.minutos_antes}`,
    data: { url: `/calendar/${lembrete.evento_id}` },
  });
}

export default function LembretesCalendario() {
  useEffect(() => {
    let ativo = true;
    let consultando = false;
    const exibidos = new Set<string>();
    let requisicao: AbortController | null = null;

    async function consultar() {
      if (!ativo || consultando || document.visibilityState !== "visible") return;
      consultando = true;
      const controller = new AbortController(); requisicao = controller;
      const prazo = setTimeout(() => controller.abort(), 15000);
      try {
        const lembretes = await consultarLembretes(controller.signal);
        if (!ativo) return;
        for (const lembrete of lembretes) {
          if (!ativo || controller.signal.aborted) return;
          const chave = `${lembrete.evento_id}:${lembrete.versao}:${lembrete.minutos_antes}`;
          if (!exibidos.has(chave)) {
            avisar(`Lembrete: ${lembrete.titulo} — ${descricao(lembrete)}`);
            await notificarNoAparelho(lembrete).catch(() => undefined);
            exibidos.add(chave);
          }
          // Se a resposta se perder, tenta confirmar de novo sem repetir o toast.
          await confirmarLembrete(lembrete, controller.signal);
        }
      } catch {
        // O calendário continua utilizável offline ou durante o cold start do backend.
      } finally {
        clearTimeout(prazo);
        consultando = false;
      }
    }

    const solicitar = () => {
      if (navigator.locks) void navigator.locks.request("insight-lembretes", { ifAvailable: true }, lock => lock ? consultar() : undefined);
      else void consultar();
    };
    const primeiraConsulta = window.setTimeout(solicitar, 1800);
    const intervalo = window.setInterval(solicitar, 60_000);
    const aoFocar = solicitar;
    window.addEventListener("focus", aoFocar);

    return () => {
      ativo = false;
      requisicao?.abort();
      window.clearTimeout(primeiraConsulta);
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
    };
  }, []);

  return null;
}
