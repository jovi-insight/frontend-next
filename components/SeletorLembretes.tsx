"use client";

import { useState } from "react";
import { LEMBRETES_CALENDARIO } from "@/lib/calendario";
import { ativarPush, desativarPush } from "@/lib/calendario-notificacoes";

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
  const [ativando, setAtivando] = useState(false);

  function alternar(minutos: number) {
    onChange(
      valores.includes(minutos)
        ? valores.filter((valor) => valor !== minutos)
        : [...valores, minutos].sort((a, b) => b - a),
    );
  }

  async function ativarNotificacoes() {
    setAtivando(true);
    try { setMensagemPermissao(await ativarPush()); }
    catch (e) { setMensagemPermissao((e as Error).message); }
    finally { setAtivando(false); }
  }
  async function desativarNotificacoes() {
    setAtivando(true);
    try { setMensagemPermissao(await desativarPush()); }
    catch (e) { setMensagemPermissao((e as Error).message); }
    finally { setAtivando(false); }
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
        <button type="button" onClick={() => void ativarNotificacoes()} disabled={disabled || ativando}>
          <span className="material-symbols-outlined" aria-hidden="true">phone_in_talk</span>
          {ativando ? "Conferindo notificações…" : "Ativar lembretes com app fechado"}
        </button>
        <button type="button" onClick={() => void desativarNotificacoes()} disabled={disabled || ativando}>Desativar neste aparelho</button>
        {mensagemPermissao && <small role="status">{mensagemPermissao}</small>}
      </div>
    </section>
  );
}
