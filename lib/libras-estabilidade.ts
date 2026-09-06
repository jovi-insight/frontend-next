/** Consenso temporal do alfabeto. Confiança do classificador não é acurácia. */
export type PontoMao = { x: number; y: number; z: number };
export type LeituraLibras = {
  status: "sem-mao" | "incerto" | "movimento" | "estabilizando" | "confirmado" | "conflito";
  letter?: string;
  confidence?: number;
  motion?: { speed: number; moving: boolean };
  dynamic?: boolean;
  source?: string;
};

export type PredicaoTemporal = {
  letter: string;
  confidence: number;
  capturadoEm: number;
  pontos: PontoMao[];
};

export type LeituraEstavel = {
  letra: string | null;
  confianca: number;
  estado: LeituraLibras["status"];
  progresso: number;
  registrar: string | null;
};

const LETRAS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZÇ");
const JANELA_MS = 700;
const SOLTAR_MS = 350;

function escala(pontos: PontoMao[]) {
  return (Math.hypot(pontos[9].x - pontos[0].x, pontos[9].y - pontos[0].y) +
    Math.hypot(pontos[17].x - pontos[5].x, pontos[17].y - pontos[5].y)) / 2;
}

export function orientacaoEnquadramento(pontos: PontoMao[]): string | null {
  if (pontos.length !== 21 || pontos.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))) {
    return "Mostre a mão inteira para a câmera.";
  }
  if (pontos.some((p) => p.x < 0.015 || p.x > 0.985 || p.y < 0.015 || p.y > 0.985)) {
    return "Afaste um pouco a mão: há dedos fora do quadro.";
  }
  if (escala(pontos) < 0.045) return "Aproxime a mão para enxergar melhor os dedos.";
  return null;
}

/** Rejeita a resposta de uma pose antiga, mesmo que a rede a entregue agora. */
export function mesmaPose(antes: PontoMao[], agora: PontoMao[]): boolean {
  if (antes.length !== 21 || agora.length !== 21) return false;
  const a = escala(antes);
  const b = escala(agora);
  if (a < 0.01 || b < 0.01) return false;
  let erro = 0;
  let maior = 0;
  for (let i = 1; i < 21; i++) {
    const dx = (antes[i].x - antes[0].x) / a - (agora[i].x - agora[0].x) / b;
    const dy = (antes[i].y - antes[0].y) / a - (agora[i].y - agora[0].y) / b;
    const dz = (antes[i].z - antes[0].z) / a - (agora[i].z - agora[0].z) / b;
    const distancia = Math.hypot(dx, dy, dz * 0.5);
    if (!Number.isFinite(distancia)) return false;
    erro += distancia ** 2;
    maior = Math.max(maior, distancia);
  }
  return Math.sqrt(erro / 20) <= 0.12 && maior <= 0.3;
}

export function consensoNeural(amostras: PredicaoTemporal[], agora: number): PredicaoTemporal | null {
  const recentes = amostras.filter((item) => agora - item.capturadoEm <= 900);
  const ultima = recentes.at(-1);
  if (!ultima || agora - ultima.capturadoEm > 650) return null;
  const iguais = recentes.filter((item) => item.letter === ultima.letter);
  if (new Set(iguais.map((item) => item.capturadoEm)).size < 3 || iguais.length / recentes.length < 0.8) {
    return null;
  }
  return { ...ultima, confidence: iguais.reduce((soma, item) => soma + item.confidence, 0) / iguais.length };
}

export function combinarLeituras(
  local: LeituraLibras,
  neural: PredicaoTemporal | null,
  pontos: PontoMao[],
  agora: number,
): LeituraLibras {
  if (local.dynamic || local.motion?.moving || local.status === "sem-mao") return local;
  if (!neural || agora - neural.capturadoEm > 650 || !mesmaPose(neural.pontos, pontos)) return local;
  // A calibração pessoal e as classes ausentes no modelo publicado mantêm sua leitura local.
  if (local.letter && (local.source === "calibrado" || local.source === "rede-neural-pessoal" ||
    local.letter === "X" || local.letter === "Y")) return local;
  if (local.letter && local.letter !== neural.letter) {
    return { status: "conflito", motion: local.motion };
  }
  if (local.letter) return { ...local, confidence: Math.min(local.confidence ?? 0, neural.confidence) };
  return { status: "confirmado", letter: neural.letter, confidence: neural.confidence, motion: local.motion };
}

/** Só emite uma letra após concordância sustentada; um quadro perdido não a repete. */
export class EstabilizadorLibras {
  private votos: Array<{ letra: string | null; confianca: number; tempo: number }> = [];
  private exibida: string | null = null;
  private confianca = 0;
  private ultimaRegistrada: string | null = null;
  private semPoseDesde: number | null = null;
  private ultimaConfirmacao = -Infinity;
  private ultimoQuadro = -Infinity;
  private ultimoDinamico = -Infinity;
  private candidata: string | null = null;
  private candidataDesde = 0;

  resetar() {
    this.votos = [];
    this.exibida = null;
    this.confianca = 0;
    this.ultimaRegistrada = null;
    this.semPoseDesde = null;
    this.ultimaConfirmacao = -Infinity;
    this.ultimoQuadro = -Infinity;
    this.ultimoDinamico = -Infinity;
    this.candidata = null;
  }

  processar(leitura: LeituraLibras, agora: number): LeituraEstavel {
    if (agora - this.ultimoQuadro > 300) {
      this.votos = [];
      this.candidata = null;
    }
    this.ultimoQuadro = agora;
    this.votos = this.votos.filter((voto) => agora - voto.tempo <= JANELA_MS);
    const sair = (estado: LeituraLibras["status"], progresso = 0, registrar: string | null = null): LeituraEstavel => ({
      letra: this.exibida, confianca: this.confianca, estado, progresso, registrar,
    });
    const letra = leitura.letter;
    if (leitura.dynamic && letra && LETRAS.has(letra) && leitura.status === "confirmado") {
      if (agora - this.ultimoDinamico < 900) return sair("movimento");
      this.ultimoDinamico = agora;
      this.exibida = letra;
      this.confianca = leitura.confidence ?? 0;
      this.ultimaRegistrada = letra;
      this.ultimaConfirmacao = agora;
      this.semPoseDesde = null;
      this.votos = [];
      this.candidata = null;
      return sair("confirmado", 1, letra);
    }
    const soltou = leitura.status === "sem-mao" || leitura.status === "movimento";
    if (soltou) {
      this.semPoseDesde ??= agora;
      if (agora - this.semPoseDesde >= SOLTAR_MS) this.ultimaRegistrada = null;
    } else {
      this.semPoseDesde = null;
    }
    const valida = !leitura.motion?.moving &&
      (leitura.status === "estabilizando" || leitura.status === "confirmado") &&
      letra && LETRAS.has(letra) && Number.isFinite(leitura.confidence) && (leitura.confidence ?? 0) >= 0.6;
    this.votos.push({ letra: valida ? letra : null, confianca: leitura.confidence ?? 0, tempo: agora });
    // Janela temporal mais teto de memória para webcams com FPS muito alto.
    this.votos = this.votos.slice(-90);
    if (!valida) {
      this.candidata = null;
      if (agora - this.ultimaConfirmacao > SOLTAR_MS) this.exibida = null;
      return sair(leitura.status === "confirmado" ? "incerto" : leitura.status);
    }
    if (this.candidata !== letra) {
      this.candidata = letra;
      this.candidataDesde = agora;
    }
    const iguais = this.votos.filter((voto) => voto.letra === letra);
    const duracao = agora - this.candidataDesde;
    const espera = letra === "I" ? 1100 : ["C", "D", "G"].includes(letra) ? 850 : 360;
    // O candidato pode durar mais que a janela de votação (I/J, C/Ç e D/G/Z).
    const consenso = iguais.length >= 5 && iguais.length / this.votos.length >= 0.8;
    const confirmou = leitura.status === "confirmado" && consenso && duracao >= espera;
    if (!confirmou) {
      if (agora - this.ultimaConfirmacao > JANELA_MS) this.exibida = null;
      return sair("estabilizando", Math.min(0.95, duracao / espera));
    }
    this.exibida = letra;
    this.confianca = iguais.reduce((soma, voto) => soma + voto.confianca, 0) / iguais.length;
    this.ultimaConfirmacao = agora;
    const registrar = this.ultimaRegistrada !== letra ? letra : null;
    this.ultimaRegistrada = letra;
    return sair("confirmado", 1, registrar);
  }
}
