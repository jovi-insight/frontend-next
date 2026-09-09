/** Consenso de leituras independentes; uma resposta de OCR não é uma certeza. */
export type ConsensoMatematico = { chave: string; leituras: number; inicio: number };
export function confirmarLeitura(
  antes: ConsensoMatematico | null, expressao: string, confianca: number, agora: number,
): { candidato: ConsensoMatematico | null; confirmado: boolean } {
  // O escore do OCR não é probabilidade matemática. Leituras intermediárias
  // precisam de uma terceira captura independente, em vez de serem aceitas sozinhas.
  if (!expressao || confianca < 45 || !Number.isFinite(confianca)) return { candidato: null, confirmado: false };
  const chave = expressao.replace(/\s/g, "");
  const candidato = antes?.chave === chave && agora - antes.inicio < 2000
    ? { ...antes, leituras: antes.leituras + 1 }
    : { chave, leituras: 1, inicio: agora };
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
