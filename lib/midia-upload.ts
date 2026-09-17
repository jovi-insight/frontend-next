/** Prepara uma cópia para envio sem modificar a gravação guardada no aparelho. */
const TIPOS: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska",
  ogv: "video/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
};

export async function prepararMidia(blob: Blob, nome: string, limiteMB: number): Promise<File> {
  if (!(blob instanceof Blob) || !blob.size) {
    throw new Error("O arquivo está vazio ou indisponível. A gravação original não foi apagada; tente abrir ou baixar o vídeo.");
  }
  if (blob.size > limiteMB * 1024 * 1024) throw new Error(`O arquivo excede o limite de ${limiteMB} MB. Use um trecho menor; o original será preservado.`);
  const extensao = nome.split(".").pop()?.toLowerCase() || "";
  const declarado = blob.type.split(";")[0].trim().toLowerCase();
  const tipo = !declarado || declarado === "application/octet-stream" ? TIPOS[extensao] : declarado;
  if (!tipo || !/^(video|audio)\//.test(tipo)) throw new Error("Formato não reconhecido. Envie um vídeo MP4/WebM/MOV ou um arquivo de áudio.");
  const sufixo = extensao in TIPOS ? extensao : tipo.includes("webm") ? "webm" : tipo.startsWith("video/") ? "mp4" : "m4a";
  const seguro = (nome || `gravacao.${sufixo}`).replace(/[\r\n"\\/:]/g, "-").slice(-180);
  try {
    // Vídeos curtos recuperados do IndexedDB são materializados antes do multipart.
    // Para aulas grandes, evita duplicar centenas de MB na memória do celular.
    const dados = blob.size <= 16 * 1024 * 1024 ? await blob.arrayBuffer() : blob;
    if (dados instanceof Blob) await dados.slice(0, 64).arrayBuffer();
    const arquivo = new File([dados], seguro.includes(".") ? seguro : `${seguro}.${sufixo}`, { type: tipo });
    if (arquivo.size !== blob.size) throw new Error("Tamanho divergente");
    return arquivo;
  } catch {
    throw new Error("Não foi possível ler o arquivo salvo neste aparelho. Tente baixar o vídeo antes de gravar novamente; não limpe os dados do app.");
  }
}

export async function erroDeMidia(resposta: Response, acao: string): Promise<Error> {
  const corpo = await resposta.json().catch(() => null);
  let detalhe = typeof corpo?.detail === "string" ? corpo.detail : "";
  if (Array.isArray(corpo?.detail)) {
    detalhe = corpo.detail.slice(0, 4).map((item: { loc?: unknown[]; type?: string; msg?: string }) => {
      const campo = Array.isArray(item.loc) ? item.loc.filter(v => v !== "body").join(".") : "arquivo";
      return item.type === "missing" ? `O servidor não recebeu o campo obrigatório “${campo}”.` : `${campo}: ${item.msg || "valor inválido"}`;
    }).join(" ");
  }
  if (!detalhe) detalhe = resposta.status === 429 ? "Limite de uso atingido. Aguarde antes de tentar novamente."
    : resposta.status === 413 ? "Arquivo maior que o limite permitido pelo servidor."
    : resposta.status >= 500 ? "O servidor está indisponível ou reiniciando. Aguarde e tente novamente."
    : "O servidor recusou o envio. Tente novamente e confira o arquivo.";
  return new Error(`${acao} (HTTP ${resposta.status}): ${detalhe}`);
}
