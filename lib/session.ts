import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO, validarToken } from "./session-token";

export async function exigirSessao() {
  const jar = await cookies();
  if (!validarToken(jar.get(COOKIE_SESSAO)?.value)) redirect("/login");
}
