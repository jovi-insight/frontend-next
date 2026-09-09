/** Consenso de leituras independentes; uma resposta de OCR não é uma certeza. */
export type ConsensoMatematico = { chave: string; leituras: number; inicio: number; ultima: number };
export function confirmarLeitura(
  antes: ConsensoMatematico | null, expressao: string, confianca: number, agora: number,
): { candidato: ConsensoMatematico | null; confirmado: boolean } {
  // O escore do OCR não é probabilidade matemática. Leituras intermediárias
  // precisam de uma terceira captura independente, em vez de serem aceitas sozinhas.
  if (!expressao || confianca < 45 || !Number.isFinite(confianca)) return { candidato: null, confirmado: false };
  const chave = expressao.replace(/\s/g, "");
  const candidato = antes?.chave === chave && agora - antes.ultima < 5000
    ? { ...antes, leituras: antes.leituras + 1, ultima: agora }
    : { chave, leituras: 1, inicio: agora, ultima: agora };
  return { candidato, confirmado: candidato.leituras >= (confianca >= 80 ? 2 : 3) };
}

export type Retangulo = { x: number; y: number; width: number; height: number };
/** Coordenadas da moldura no vídeo object-fit:cover, incluindo zoom digital. */
export function recorteCamera(
  fonte: { width: number; height: number }, visor: { width: number; height: number },
  moldura: Retangulo, zoom = 1,
): Retangulo {
  const escala = Math.max(visor.width / fonte.width, visor.height / fonte.height) * Math.max(1, zoom);
  const x = (moldura.x - visor.width / 2) / escala + fonte.width / 2;
  const y = (moldura.y - visor.height / 2) / escala + fonte.height / 2;
  return { x, y, width: moldura.width / escala, height: moldura.height / escala };
}

/** Diferença normalizada no recorte, sem guardar fotos nem enviá-las a servidores. */
export function diferencaQuadros(a: Uint8Array | null, b: Uint8Array): number {
  if (!a || a.length !== b.length) return 1;
  let soma = 0;
  for (let i = 0; i < a.length; i++) soma += (a[i] - b[i]) ** 2;
  // RMS dá peso a mudanças localizadas: um único dígito não pode sumir
  // na média de todos os pixels brancos do papel.
  return Math.sqrt(soma / a.length) / 255;
}

/** Compensa tremor pequeno e variação uniforme de exposição, não troca de cena. */
export function diferencaMovimento(a: Uint8Array | null, b: Uint8Array, largura = 96, altura = 24): number {
  if (!a || a.length !== b.length || b.length !== largura * altura) return 1;
  let melhor = 1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
    let soma = 0, quadrados = 0, total = 0;
    for (let y = 2; y < altura - 2; y++) for (let x = 3; x < largura - 3; x++) {
      const delta = a[y * largura + x] - b[(y + dy) * largura + x + dx];
      soma += delta; quadrados += delta * delta; total++;
    }
    if (total) melhor = Math.min(melhor, Math.sqrt(Math.max(0, quadrados / total - (soma / total) ** 2)) / 255 + (Math.abs(dx) + Math.abs(dy)) * 0.001);
  }
  return melhor;
}
