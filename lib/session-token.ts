import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESSAO = "insight_session";
export const DURACAO_SESSAO = 60 * 60 * 8;
function chave() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure SESSION_SECRET com pelo menos 32 caracteres.");
  return secret;
}
export function criarToken(agora = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: "professor", exp: Math.floor(agora / 1000) + DURACAO_SESSAO })).toString("base64url");
  const signature = createHmac("sha256", chave()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function validarToken(token: string | undefined, agora = Date.now()): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = createHmac("sha256", chave()).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.sub === "professor" && Number.isFinite(data.exp) && data.exp > Math.floor(agora / 1000);
  } catch { return false; }
}
