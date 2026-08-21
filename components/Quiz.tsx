"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gerarQuiz, getQuiz, narrar, type Pergunta } from "@/lib/api";

const LETRAS = ["a", "b", "c", "d"] as const;
type Letra = (typeof LETRAS)[number];

type Alternativa = { letra: Letra; texto: string };
type PerguntaUI = {
  id: string;
  enunciado: string;
  alternativas: Alternativa[];
  correta: Letra | null;
  explicacao: string;
};

/** Achata QuizOut (alternativa_a..d) no formato que a tela usa. */
export function normalizar(bruta: Pergunta): PerguntaUI {
  const correta = String(bruta.resposta_correta ?? "").trim().toLowerCase().charAt(0);
  return {
    id: bruta.id,
    enunciado: bruta.pergunta ?? "",
    alternativas: LETRAS.map((letra) => ({
      letra,
      texto: bruta[`alternativa_${letra}` as const] as string,
    })).filter((alt) => typeof alt.texto === "string" && alt.texto !== ""),
    // Gabarito fora das letras conhecidas vira null: melhor a pergunta ficar
    // sem correção do que marcar a resposta certa do aluno como errada.
    correta: (LETRAS as readonly string[]).includes(correta) ? (correta as Letra) : null,
    explicacao: bruta.explicacao ?? "",
  };
}

export function avaliar(perguntas: PerguntaUI[], respostas: Map<string, Letra>) {
  let acertos = 0;
  let respondidas = 0;
  for (const p of perguntas) {
    const escolha = respostas.get(p.id);
    if (!escolha) continue;
    respondidas++;
    if (escolha === p.correta) acertos++;
  }
  return { respondidas, acertos, total: perguntas.length };
}

/** Enunciado + alternativas para a narração. O gabarito nunca entra. */
export function textoParaFala(p: PerguntaUI): string {
  return [
    p.enunciado,
    ...p.alternativas.map((a) => `Alternativa ${a.letra.toUpperCase()}. ${a.texto}`),
  ].join(" ");
}

export default function Quiz({ conteudoId }: { conteudoId: string }) {
  const [perguntas, setPerguntas] = useState<PerguntaUI[]>([]);
  const [respostas, setRespostas] = useState<Map<string, Letra>>(new Map());
  const [quantidade, setQuantidade] = useState(5);
  const [ocupado, setOcupado] = useState<string | null>("Procurando quiz salvo…");
  const [erro, setErro] = useState<string | null>(null);

  // Carga inicial: um quiz já gravado aparece pronto, sem gastar chamada de IA.
  useEffect(() => {
    let ativo = true;
    getQuiz(conteudoId)
      .then((salvo) => {
        if (ativo && salvo) setPerguntas(salvo.perguntas.map(normalizar));
      })
      .catch((e: Error) => console.warn("Falha ao buscar quiz salvo:", e))
      .finally(() => {
        if (ativo) setOcupado(null);
      });
    return () => {
      ativo = false;
    };
  }, [conteudoId]);

  // O backend ACUMULA: cada POST soma às perguntas que já existem em vez de
  // substituir (3 + 2 devolve 5 no GET). Por isso as novas são anexadas e o
  // botão diz "Gerar mais N" — um botão que empilhasse em silêncio enganaria.
  async function gerar() {
    setOcupado(`Gerando ${quantidade} perguntas com IA…`);
    setErro(null);
    try {
      const resposta = await gerarQuiz(conteudoId, quantidade);
      const novas = resposta.perguntas.map(normalizar).filter((p) => p.alternativas.length);
      setPerguntas((antes) => [...antes, ...novas]);
      if (!novas.length) setErro("A IA não devolveu perguntas para este conteúdo.");
    } catch (e) {
      setErro((e as Error).message || "Falha ao gerar o quiz.");
    } finally {
      setOcupado(null);
    }
  }

  function responder(pergunta: PerguntaUI, letra: Letra) {
    // Uma tentativa por pergunta.
    setRespostas((antes) =>
      antes.has(pergunta.id) ? antes : new Map(antes).set(pergunta.id, letra),
    );
  }

  const { respondidas, acertos, total } = avaliar(perguntas, respostas);
  const faltam = total - respondidas;

  const placar =
    total === 0
      ? "Nenhuma pergunta ainda. Gere um quiz a partir deste conteúdo."
      : respondidas === 0
        ? `${total} perguntas · toque para responder`
        : faltam > 0
          ? `${acertos} de ${respondidas} certas · faltam ${faltam}`
          : `${acertos} de ${total} certas · quiz completo`;

  return (
    <section
      className={`quiz-section${total > 0 ? " tem-perguntas" : ""}`}
      aria-label="Quiz do conteúdo"
    >
      <p className="quiz-placar" role="status" aria-live="polite">
        {ocupado ?? placar}
      </p>

      {erro && (
        <p className="quiz-explicacao" role="alert" style={{ color: "var(--error)" }}>
          {erro}
        </p>
      )}

      <div className="quiz-lista">
        {perguntas.map((p, i) => (
          <CardPergunta
            key={p.id}
            pergunta={p}
            indice={i + 1}
            escolha={respostas.get(p.id)}
            onResponder={(letra) => responder(p, letra)}
          />
        ))}
      </div>

      <div className="quiz-controles">
        <label className="quiz-qtd-label" htmlFor="quiz-qtd">
          Quantidade
        </label>
        <select
          id="quiz-qtd"
          className="quiz-qtd"
          value={quantidade}
          disabled={ocupado !== null}
          onChange={(e) => setQuantidade(Number(e.target.value))}
        >
          {[3, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n} perguntas
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`quiz-gerar${ocupado ? " is-loading" : ""}`}
          onClick={gerar}
          disabled={ocupado !== null}
        >
          {total === 0 ? "Gerar quiz" : `Gerar mais ${quantidade}`}
        </button>
      </div>
    </section>
  );
}

function CardPergunta({
  pergunta,
  indice,
  escolha,
  onResponder,
}: {
  pergunta: PerguntaUI;
  indice: number;
  escolha?: Letra;
  onResponder: (letra: Letra) => void;
}) {
  const respondida = escolha !== undefined;
  const acertou = escolha === pergunta.correta;

  return (
    <article className="quiz-card">
      <div className="quiz-cabecalho">
        <h4 className="quiz-pergunta">
          {indice}. {pergunta.enunciado}
        </h4>
        <BotaoOuvir pergunta={pergunta} />
      </div>

      <div className="quiz-alts" role="group" aria-label={pergunta.enunciado}>
        {pergunta.alternativas.map((alt) => {
          let marca = "";
          if (respondida) {
            if (alt.letra === pergunta.correta) marca = " is-correta";
            else if (alt.letra === escolha) marca = " is-errada";
          }
          return (
            <button
              key={alt.letra}
              type="button"
              className={`quiz-alt${marca}`}
              data-letra={alt.letra}
              disabled={respondida}
              aria-pressed={alt.letra === escolha}
              onClick={() => onResponder(alt.letra)}
            >
              <span className="quiz-letra">{alt.letra.toUpperCase()}</span>
              <span>{alt.texto}</span>
            </button>
          );
        })}
      </div>

      {respondida && (
        <p className="quiz-explicacao">
          {pergunta.correta === null
            ? "Sem gabarito para esta pergunta."
            : `${acertou ? "Certo!" : "Errado."}${
                pergunta.explicacao ? ` ${pergunta.explicacao}` : ""
              }`}
        </p>
      )}
    </article>
  );
}

/**
 * Narra a pergunta. O MP3 do ElevenLabs vem primeiro porque toca em qualquer
 * navegador; a voz do sistema não é garantida (no Linux depende do
 * speech-dispatcher e, sem ele, speak() é aceito e não sai som nenhum).
 */
function BotaoOuvir({ pergunta }: { pergunta: PerguntaUI }) {
  const [estado, setEstado] = useState<"parado" | "carregando" | "falando">("parado");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const parar = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setEstado("parado");
  }, []);

  // Sair da página no meio da narração não pode deixar a voz tocando, e o
  // object URL do MP3 precisa ser liberado.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  function falarComNavegador(): boolean {
    if (typeof speechSynthesis === "undefined") return false;
    if (speechSynthesis.getVoices().length === 0) return false;

    const fala = new SpeechSynthesisUtterance(textoParaFala(pergunta));
    fala.lang = "pt-BR";
    fala.rate = 0.95;
    // Só lang não basta: em várias combinações de Chrome + Linux a fala sai
    // muda se a voz não vier escolhida explicitamente.
    const voz = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
    if (voz) fala.voice = voz;
    fala.onend = parar;
    fala.onerror = parar;
    // O Chrome deixa a fila em pausa depois de ocioso e o speak() seguinte
    // entra nela sem nunca tocar.
    speechSynthesis.resume();
    speechSynthesis.speak(fala);
    setEstado("falando");
    return true;
  }

  async function alternar() {
    if (estado !== "parado") return parar();

    setEstado("carregando");
    try {
      if (!urlRef.current) {
        const blob = await narrar(textoParaFala(pergunta), "pt");
        urlRef.current = URL.createObjectURL(blob); // reouvir não gasta outra chamada
      }
      const audio = new Audio(urlRef.current);
      audio.onended = parar;
      audio.onerror = parar;
      await audio.play();
      audioRef.current = audio;
      setEstado("falando");
      return;
    } catch (e) {
      console.warn("Narração do backend indisponível, usando a voz do navegador:", e);
    }

    if (!falarComNavegador()) setEstado("parado");
  }

  const icone =
    estado === "falando" ? "stop_circle" : estado === "carregando" ? "progress_activity" : "volume_up";

  return (
    <button
      type="button"
      className={`quiz-ouvir${estado !== "parado" ? " is-falando" : ""}`}
      aria-label="Ouvir a pergunta e as alternativas"
      aria-pressed={estado !== "parado"}
      onClick={alternar}
    >
      <span
        className={`material-symbols-outlined${estado === "carregando" ? " girando" : ""}`}
      >
        {icone}
      </span>
    </button>
  );
}
