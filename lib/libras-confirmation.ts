export type LeituraLibras = {
  status: "sem-mao" | "incerto" | "movimento" | "estabilizando" | "confirmado";
  letter?: string;
  confidence?: number;
  dynamic?: boolean;
};

export type ConfirmacaoLibras = {
  visivel: string | null;
  confianca: number;
  registrar: string | null;
};

const VAZIA: ConfirmacaoLibras = { visivel: null, confianca: 0, registrar: null };

export function criarConfirmadorLibras({
  tempoConfirmacaoMs = 600,
  tempoLiberacaoMs = 300,
  confiancaMovimento = 0.86,
} = {}) {
  let candidata: string | null = null;
  let candidataDesde = 0;
  let bloqueada: string | null = null;
  let neutraDesde: number | null = null;

  const limparCandidata = () => {
    candidata = null;
    candidataDesde = 0;
  };

  const bloquear = (letter: string, confidence: number): ConfirmacaoLibras => {
    bloqueada = letter;
    neutraDesde = null;
    limparCandidata();
    return { visivel: letter, confianca: confidence, registrar: letter };
  };

  return {
    processar(leitura: LeituraLibras, agora: number): ConfirmacaoLibras {
      const confirmada = leitura.status === "confirmado" && Boolean(leitura.letter);
      const confianca = leitura.confidence ?? 0;
      const forte = confirmada && !leitura.dynamic;
      const movimentoForte =
        confirmada && Boolean(leitura.dynamic) && confianca >= confiancaMovimento;

      if (bloqueada) {
        if ((forte || movimentoForte) && leitura.letter === bloqueada) {
          neutraDesde = null;
          return { visivel: bloqueada, confianca, registrar: null };
        }

        const neutra = !confirmada;
        if (neutra && neutraDesde === null) neutraDesde = agora;
        if (neutraDesde === null || agora - neutraDesde < tempoLiberacaoMs) {
          if (!neutra) neutraDesde = null;
          return VAZIA;
        }

        bloqueada = null;
        neutraDesde = null;
        limparCandidata();
      }

      if (movimentoForte && leitura.letter) return bloquear(leitura.letter, confianca);

      if (!forte || leitura.dynamic || !leitura.letter) {
        limparCandidata();
        return VAZIA;
      }

      if (candidata !== leitura.letter) {
        candidata = leitura.letter;
        candidataDesde = agora;
        return VAZIA;
      }

      if (agora - candidataDesde < tempoConfirmacaoMs) return VAZIA;
      return bloquear(leitura.letter, confianca);
    },

    resetar() {
      bloqueada = null;
      neutraDesde = null;
      limparCandidata();
    },
  };
}
