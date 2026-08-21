/**
 * Fila de blocos de áudio para transcrição. Porte de
 * frontend/js/live-stt-backend.js (núcleo puro, sem DOM nem microfone).
 *
 * Três garantias que uma sequência de `await` solta não daria:
 *  - entrega **em ordem**: o bloco 3 nunca aparece antes do 2, mesmo que a
 *    resposta dele volte primeiro;
 *  - **concorrência limitada**: um bloco por vez, para uma aula longa não
 *    disparar dezenas de uploads em paralelo;
 *  - **isolamento de falha**: um bloco que dá erro não derruba a sessão.
 */

export type Processador = {
  adicionar: (blob: Blob) => void;
  emVoo: () => number;
  destruir: () => void;
};

export function criarProcessadorDeBlocos(opcoes: {
  transcrever: (blob: Blob) => Promise<string>;
  aoEntregar?: (texto: string, indice: number) => void;
  aoFalhar?: (erro: unknown, indice: number) => void;
  limiteConcorrencia?: number;
}): Processador {
  const { transcrever } = opcoes;
  const aoEntregar = opcoes.aoEntregar ?? (() => {});
  const aoFalhar = opcoes.aoFalhar ?? (() => {});
  const limite = Math.max(1, Number(opcoes.limiteConcorrencia) || 1);

  let proximoIndice = 0; // índice do próximo bloco a entrar na fila
  let proximoAEntregar = 0; // índice do próximo a sair, em ordem
  const resolvidos = new Map<number, { ok: boolean; texto?: string; erro?: unknown }>();
  const fila: { indice: number; blob: Blob }[] = [];
  let emVoo = 0;
  let descartado = false; // após destruir(), nenhuma resposta é entregue

  function entregarProntos() {
    while (resolvidos.has(proximoAEntregar)) {
      const resultado = resolvidos.get(proximoAEntregar)!;
      resolvidos.delete(proximoAEntregar);
      const indice = proximoAEntregar;
      proximoAEntregar++;
      if (resultado.ok) {
        if (resultado.texto) aoEntregar(resultado.texto, indice);
      } else {
        aoFalhar(resultado.erro, indice);
      }
    }
  }

  function bombear() {
    while (!descartado && emVoo < limite && fila.length) {
      const item = fila.shift()!;
      emVoo++;
      // Promise.resolve().then(...) faz um transcrever() que lança de forma
      // síncrona virar rejeição: a falha de um bloco não derruba a sessão.
      Promise.resolve()
        .then(() => transcrever(item.blob))
        .then(
          (texto) => {
            emVoo--;
            if (descartado) return;
            resolvidos.set(item.indice, { ok: true, texto });
            entregarProntos();
            bombear();
          },
          (erro) => {
            emVoo--;
            if (descartado) return;
            resolvidos.set(item.indice, { ok: false, erro });
            entregarProntos();
            bombear();
          },
        );
    }
  }

  return {
    adicionar(blob) {
      if (descartado) return;
      fila.push({ indice: proximoIndice++, blob });
      bombear();
    },
    emVoo: () => emVoo,
    // Descarta o que não voltou e ignora respostas atrasadas: sem isso, uma
    // transcrição em voo poderia sujar a próxima aula.
    destruir() {
      descartado = true;
      fila.length = 0;
      resolvidos.clear();
    },
  };
}

const TIPOS_AUDIO = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

export function melhorTipoAudio(): string {
  if (typeof MediaRecorder !== "function" || !MediaRecorder.isTypeSupported) return "";
  return TIPOS_AUDIO.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function extensaoPara(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "audio";
}

/**
 * Duplicata colada no tempo é reentrega da API de fala; a mesma frase alguns
 * segundos depois é o professor enfatizando, e precisa entrar na transcrição.
 */
export function ehDuplicata(
  ultimo: { texto: string; segundo: number } | undefined,
  texto: string,
  segundos: number,
): boolean {
  return Boolean(ultimo && ultimo.texto === texto && segundos - ultimo.segundo < 3);
}
