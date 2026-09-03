"use client";

import { useState } from "react";
import { LEMBRETES_CALENDARIO } from "@/lib/calendario";

export default function SeletorLembretes({
  valores,
  onChange,
  disabled = false,
}: {
  valores: number[];
  onChange: (valores: number[]) => void;
  disabled?: boolean;
}) {
  const [mensagemPermissao, setMensagemPermissao] = useState<string | null>(null);

  function alternar(minutos: number) {
    onChange(
      valores.includes(minutos)
        ? valores.filter((valor) => valor !== minutos)
        : [...valores, minutos].sort((a, b) => b - a),
    );
  }

  async function ativarNotificacoes() {
    if (!("Notification" in window)) {
      setMensagemPermissao("Este navegador não oferece notificações.");
      return;
    }
    const permissao = await Notification.requestPermission();
    setMensagemPermissao(
      permissao === "granted"
        ? "Notificações do aparelho ativadas."
        : permissao === "denied"
          ? "Notificações bloqueadas no navegador. Os avisos continuam aparecendo no INSIGHT."
          : "Permissão ainda não concedida. Os avisos continuam aparecendo no INSIGHT.",
    );
  }

  return (
    <section className="evento-lembretes" aria-labelledby="evento-lembretes-titulo">
      <header>
        <span className="material-symbols-outlined" aria-hidden="true">notifications_active</span>
        <div>
          <strong id="evento-lembretes-titulo">Lembretes</strong>
          <small>Salvos no banco e entregues ao abrir ou usar o INSIGHT.</small>
        </div>
      </header>

      <div className="evento-lembretes-opcoes">
        {LEMBRETES_CALENDARIO.map((opcao) => (
          <button
            key={opcao.minutos}
            type="button"
            className={valores.includes(opcao.minutos) ? "ativo" : ""}
            aria-pressed={valores.includes(opcao.minutos)}
            onClick={() => alternar(opcao.minutos)}
            disabled={disabled}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {valores.includes(opcao.minutos) ? "check" : "add"}
            </span>
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <div className="evento-lembretes-permissao">
        <button type="button" onClick={() => void ativarNotificacoes()} disabled={disabled}>
          <span className="material-symbols-outlined" aria-hidden="true">phone_in_talk</span>
          Ativar notificação no aparelho
        </button>
        {mensagemPermissao && <small role="status">{mensagemPermissao}</small>}
      </div>
    </section>
  );
}
