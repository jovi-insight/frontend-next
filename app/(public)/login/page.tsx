"use client";
import Link from "next/link";
import { useLogin } from "@/lib/use-login";
export default function LoginPage() {
  const { entrar, erro, ocupado } = useLogin();
  return <main className="min-h-screen bg-[#fdfdfd] px-6 py-12 sm:py-20">
    <div className="mx-auto max-w-md">
      <Link href="/" className="text-lg font-bold tracking-widest">INSIGHT</Link>
      <h1 className="mt-12 text-3xl font-bold sm:text-4xl">Seu próximo passo começa aqui.</h1>
      <p className="mt-4 text-zinc-600">Entre para capturar, organizar e revisar suas aulas.</p>
      <form onSubmit={entrar} className="mt-8 grid gap-5" aria-label="Entrar no INSIGHT">
        <label className="grid gap-2 font-semibold">E-mail<input name="email" type="email" autoComplete="username" required className="w-full rounded-xl border border-solid border-zinc-400 bg-white p-3 text-base" /></label>
        <label className="grid gap-2 font-semibold">Senha<input name="password" type="password" autoComplete="current-password" required className="w-full rounded-xl border border-solid border-zinc-400 bg-white p-3 text-base" /></label>
        {erro && <p role="alert" className="text-red-700">{erro}</p>}
        <button disabled={ocupado} className="rounded-xl bg-[#cfc5ff] px-5 py-4 text-base font-bold disabled:opacity-50">{ocupado ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">Demonstração acadêmica com dados compartilhados. As credenciais de avaliação estão no README do projeto.</p>
      <Link href="/" className="mt-6 inline-block underline">Voltar à apresentação</Link>
    </div>
  </main>;
}
