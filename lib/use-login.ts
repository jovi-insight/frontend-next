"use client";
import { useState, type FormEvent } from "react";
export function useLogin() {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErro(""); setOcupado(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar.");
      // Recarrega o documento para descartar o cache privado e trocar o layout raiz.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/camera");
    } catch (error) { setErro(error instanceof Error ? error.message : "Confira sua conexão e tente novamente."); setOcupado(false); }
  }
  return { entrar, erro, ocupado };
}
