"use client";

import { useMemo, useRef, useState } from "react";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import { traduzirTexto, traduzirImagem } from "@/lib/api";
import { useLocalStorage } from "@/lib/use-local-storage";
import { avisar } from "@/lib/avisos";

// Nomes legíveis: o backend recebe o idioma por extenso, não código ISO.
const IDIOMAS: Record<string, string> = {
  pt: "português brasileiro",
  en: "inglês americano",
  es: "espanhol",
  fr: "francês",
  de: "alemão",
};

function TranslateConteudo() {
  // Pré-carrega o texto do último documento aberto, como no vanilla. Lido
  // direto do localStorage: com useEffect + setState a tela renderizaria duas
  // vezes e o campo piscaria vazio antes de preencher.
  const ultimoScan = useLocalStorage("jovi_last_scan_result");
  const textoInicial = useMemo(() => {
    try {
      const doc = JSON.parse(ultimoScan || "{}");
      return doc.resumo_ia || doc.extracao_original || doc.texto_extraido || "";
    } catch {
      return ""; // json inválido no storage não impede usar a tela
    }
  }, [ultimoScan]);

  const [origem, setOrigem] = useState(textoInicial);
  const [destino, setDestino] = useState("en");
  const [traducao, setTraducao] = useState("");
  const [traduzindo, setTraduzindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement | null>(null);

  // Cada tradução recebe um número; respostas de pedidos antigos que chegam
  // atrasadas são descartadas, senão sobrescreveriam a tradução mais recente.
  const pedidoRef = useRef(0);

  async function traduzir() {
    const texto = origem.trim();
    if (!texto) return;

    const meu = ++pedidoRef.current;
    setTraduzindo(true);
    setErro(null);
    try {
      const { traducao: resultado } = await traduzirTexto(texto, IDIOMAS[destino]);
      if (meu !== pedidoRef.current) return; // chegou fora de ordem
      setTraducao(resultado);
    } catch (e) {
      if (meu === pedidoRef.current) setErro((e as Error).message);
    } finally {
      if (meu === pedidoRef.current) setTraduzindo(false);
    }
  }

  /** Foto do quadro ou de uma página: o backend lê e traduz num passo só. */
  async function traduzirFoto(arquivo: File) {
    const meu = ++pedidoRef.current;
    setTraduzindo(true);
    setErro(null);
    setTraducao("");
    try {
      const { traducao: resultado } = await traduzirImagem(arquivo);
      if (meu !== pedidoRef.current) return;
      setTraducao(resultado);
      setOrigem("(Tradução gerada a partir da imagem enviada.)");
      avisar("Imagem traduzida.", "sucesso");
    } catch (e) {
      if (meu === pedidoRef.current) setErro((e as Error).message);
    } finally {
      if (meu === pedidoRef.current) setTraduzindo(false);
    }
  }

  /** Manda a tradução de volta para o campo de origem e inverte o destino. */
  function inverter() {
    if (!traducao.trim()) return;
    const anterior = origem;
    setOrigem(traducao);
    setTraducao(anterior);
    // O backend detecta a origem sozinho; só o destino precisa mudar de lado.
    setDestino((atual) => (atual === "pt" ? "en" : "pt"));
  }

  async function copiar() {
    if (!traducao.trim()) return avisar("Nada para exportar ainda.", "info");
    try {
      await navigator.clipboard.writeText(traducao);
      avisar("Tradução copiada para a área de transferência.", "sucesso");
    } catch {
      avisar("Não foi possível copiar automaticamente.", "erro");
    }
  }

  return (
    <>

      <main className="container archive-main sem-topbar">
        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Tradutor</h2>
          </div>
          <button
            type="button"
            className="chip"
            onClick={() => arquivoRef.current?.click()}
            disabled={traduzindo}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              photo_camera
            </span>
            Traduzir imagem
          </button>
        </div>

        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) traduzirFoto(arquivo);
            e.target.value = ""; // permite reenviar a mesma imagem
          }}
        />

        <label className="form-label" htmlFor="texto-origem">
          Texto original
        </label>
        <textarea
          id="texto-origem"
          className="form-input"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          rows={8}
          placeholder="Cole ou digite o texto…"
          style={{ width: "100%", marginBottom: 16, resize: "vertical" }}
        />

        <div className="quiz-controles" style={{ marginBottom: 24 }}>
          <label className="quiz-qtd-label" htmlFor="idioma-destino">
            Traduzir para
          </label>
          <select
            id="idioma-destino"
            className="quiz-qtd"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
          >
            {Object.entries(IDIOMAS).map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`quiz-gerar${traduzindo ? " is-loading" : ""}`}
            onClick={traduzir}
            disabled={traduzindo || !origem.trim()}
          >
            {traduzindo ? "Traduzindo…" : "Traduzir"}
          </button>
        </div>

        {erro && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginBottom: 16 }}>
            {erro}
          </p>
        )}

        {traducao && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                <h3 className="secao-titulo">Tradução</h3>
              </div>
              <div className="secao-acoes">
                <button type="button" className="chip" onClick={inverter}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    swap_vert
                  </span>
                  Inverter
                </button>
                <button type="button" className="chip" onClick={copiar}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    content_copy
                  </span>
                  Copiar
                </button>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-text" style={{ whiteSpace: "pre-wrap" }}>
                {traducao}
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default function TranslatePage() {
  return (
    <GuardaSessao>
      <TranslateConteudo />
    </GuardaSessao>
  );
}
