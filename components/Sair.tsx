"use client";
import { useState } from "react";
export default function Sair() {
  const [erro, setErro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function sair() {
    setOcupado(true); setErro(false);
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error();
      // Recarrega o documento para descartar o cache privado e trocar o layout raiz.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch { setErro(true); setOcupado(false); }
  }
  return <div className="fixed right-3 z-[100] bottom-[calc(80px+env(safe-area-inset-bottom))]">
    {erro && <p role="alert" className="rounded bg-red-950 p-2 text-white">Não foi possível sair. Tente novamente.</p>}
    <button type="button" onClick={sair} disabled={ocupado} className="rounded-full border border-solid border-white/30 bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg disabled:opacity-50">{ocupado ? "Saindo…" : "Sair"}</button>
  </div>;
}
