"use client";

import { useAvisos, dispensar, type TipoAviso } from "@/lib/avisos";

const ICONE: Record<TipoAviso, string> = {
  info: "info",
  sucesso: "check_circle",
  erro: "error",
};

/**
 * Pilha de avisos, montada uma vez no layout raiz.
 *
 * `role="status"` e não `alert`: alert interrompe o leitor de tela no meio da
 * frase, e a maioria destes avisos é confirmação, não urgência.
 */
export default function Avisos() {
  const avisos = useAvisos();
  if (avisos.length === 0) return null;

  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`aviso aviso-${a.tipo}`}
          onClick={() => dispensar(a.id)}
          // Toque dispensa antes da hora; o aria-label explica isso a quem
          // navega por leitor de tela e ouve só o texto.
          aria-label={`${a.texto}. Toque para dispensar.`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {ICONE[a.tipo]}
          </span>
          <span>{a.texto}</span>
        </button>
      ))}
    </div>
  );
}
