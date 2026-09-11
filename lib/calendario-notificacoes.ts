import { BASE_URL, type LembreteCalendarioPendente } from "./api";

export type LembreteConfirmavel = LembreteCalendarioPendente & { versao: string };
export async function consultarLembretes(signal: AbortSignal): Promise<LembreteConfirmavel[]> {
  const resposta = await fetch(`${BASE_URL}/calendario/lembretes/pendentes`, { signal, cache: "no-store" });
  if (!resposta.ok) throw new Error("Lembretes indisponíveis.");
  return resposta.json();
}
export async function confirmarLembrete(lembrete: LembreteConfirmavel, signal: AbortSignal) {
  const resposta = await fetch(`${BASE_URL}/calendario/lembretes/confirmar`, {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evento_id: lembrete.evento_id, versao: lembrete.versao, minutos_antes: lembrete.minutos_antes }),
  });
  if (!resposta.ok && resposta.status !== 409 && resposta.status !== 404) throw new Error("Confirmação pendente.");
}

type ConfigPush = { configurado: boolean; worker_ativo: boolean; chave_publica: string | null };
export async function ativarPush(): Promise<string> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "Este navegador não oferece Web Push. No iPhone, instale o INSIGHT na Tela de Início e abra por lá. Os avisos ao abrir o app continuam disponíveis.";
  }
  // A permissão deve ser pedida no gesto do aluno, antes de aguardar a rede.
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied"
    ? "Notificações bloqueadas. Libere nas configurações do navegador; os avisos no app continuam disponíveis."
    : "Permissão não concedida. Nenhuma notificação em segundo plano foi ativada.";
  const resposta = await fetch(`${BASE_URL}/calendario/push/config`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!resposta.ok) throw new Error("Não foi possível conferir o servidor de notificações. Tente novamente.");
  const config: ConfigPush = await resposta.json();
  if (!config.configurado || !config.chave_publica) return "Permissão concedida, mas o servidor ainda não tem Web Push configurado. Por enquanto, os lembretes aparecem com o INSIGHT aberto.";
  const registro = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Abra novamente o app para concluir a instalação das notificações.")), 8000)),
  ]);
  const base64 = config.chave_publica.replace(/-/g, "+").replace(/_/g, "/");
  const chave = Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
  const assinatura = await registro.pushManager.getSubscription() || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  const salva = await fetch(`${BASE_URL}/calendario/push/inscricoes`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assinatura.toJSON()), signal: AbortSignal.timeout(12000),
  });
  if (!salva.ok) throw new Error("Não foi possível registrar este aparelho no servidor. Tente ativar novamente.");
  return config.worker_ativo
    ? "Aparelho registrado para receber lembretes mesmo com o app fechado. A entrega depende da conexão e das permissões do sistema."
    : "Aparelho registrado, mas o emissor de lembretes está offline. Os avisos com o app fechado só funcionarão quando o worker estiver ativo.";
}

export async function desativarPush(): Promise<string> {
  if (!("serviceWorker" in navigator)) return "Notificações não disponíveis neste navegador.";
  const registro = await navigator.serviceWorker.getRegistration();
  const assinatura = await registro?.pushManager?.getSubscription();
  if (!assinatura) return "Este aparelho não está inscrito no Web Push.";
  const resposta = await fetch(`${BASE_URL}/calendario/push/desativar`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(assinatura.toJSON()), signal: AbortSignal.timeout(12000),
  });
  if (!resposta.ok) throw new Error("Não foi possível desativar no servidor. Tente novamente.");
  await assinatura.unsubscribe();
  return "Lembretes com o app fechado desativados neste aparelho.";
}
