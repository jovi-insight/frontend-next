import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, criarToken, DURACAO_SESSAO } from "@/lib/session-token";

function mesmaOrigem(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
export async function POST(request: NextRequest) {
  if (!mesmaOrigem(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  let dados;
  try { dados = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (dados?.email !== (process.env.DEMO_EMAIL || "professor@insight.com") || dados?.password !== (process.env.DEMO_PASSWORD || "Insight@2026")) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }
  try {
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(COOKIE_SESSAO, criarToken(), {
      httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: DURACAO_SESSAO,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "O servidor precisa configurar a chave de sessão." }, { status: 503 });
  }
}
export async function DELETE(request: NextRequest) {
  if (!mesmaOrigem(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_SESSAO, "", { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
