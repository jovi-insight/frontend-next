"use client";

import { useEffect } from "react";
import { consumirLembretesCalendario, type LembreteCalendarioPendente } from "@/lib/api";
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

  const registro = await navigator.serviceWorker.ready;
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

    async function consultar() {
      if (!ativo || consultando) return;
      consultando = true;
      try {
        const lembretes = await consumirLembretesCalendario();
        if (!ativo) return;
        for (const lembrete of lembretes) {
          avisar(`Lembrete: ${lembrete.titulo} — ${descricao(lembrete)}`);
          await notificarNoAparelho(lembrete).catch(() => undefined);
        }
      } catch {
        // O calendário continua utilizável offline ou durante o cold start do backend.
      } finally {
        consultando = false;
      }
    }

    const primeiraConsulta = window.setTimeout(() => void consultar(), 1800);
    const intervalo = window.setInterval(() => void consultar(), 60_000);
    const aoFocar = () => void consultar();
    window.addEventListener("focus", aoFocar);

    return () => {
      ativo = false;
      window.clearTimeout(primeiraConsulta);
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
    };
  }, []);

  return null;
}
