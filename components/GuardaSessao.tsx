"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

// localStorage é um estado externo ao React, e é para isso que serve o
// useSyncExternalStore: ele aceita um valor diferente no servidor (onde
// localStorage não existe) sem erro de hidratação, e sem o setState dentro de
// useEffect que dispara uma renderização em cascata.
const NUNCA_MUDA = () => () => {};
const lerNoCliente = () => localStorage.getItem("jovi_session") !== null;
const lerNoServidor = () => false;

/**
 * Equivalente ao <script> inline que cada página do vanilla tinha:
 *
 *     if (!localStorage.getItem('jovi_session')) location.href = 'login.html';
 */
export default function GuardaSessao({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const temSessao = useSyncExternalStore(NUNCA_MUDA, lerNoCliente, lerNoServidor);

  useEffect(() => {
    // Lê o localStorage aqui em vez de usar `temSessao`: no commit da
    // hidratação o React ainda serve o snapshot do servidor (false), e o
    // efeito rodaria antes da correção — mandando para /login quem TEM sessão.
    if (localStorage.getItem("jovi_session") === null) router.replace("/login");
  }, [router]);

  // Enquanto redireciona, nada do conteúdo protegido aparece.
  if (!temSessao) {
    return (
      <main className="container" style={{ paddingTop: 120 }}>
        <div className="spinner" />
      </main>
    );
  }

  return <>{children}</>;
}
