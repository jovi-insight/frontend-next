"use client";

import { useMemo, useRef, useState } from "react";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import BottomNav from "@/components/BottomNav";
import { traduzirTexto } from "@/lib/api";
import { useLocalStorage } from "@/lib/use-local-storage";

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

  return (
    <>
      <TopHeader titulo="Translate" />

      <main className="container archive-main">
        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Tradutor</h2>
          </div>
        </div>

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
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
              <h3 className="secao-titulo">Tradução</h3>
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
