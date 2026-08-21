"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import { getMaterias, criarMateria, confirmarConteudo, type Materia } from "@/lib/api";
import { useLocalStorage, gravarLocalStorage } from "@/lib/use-local-storage";
import { avisar } from "@/lib/avisos";

type ScanData = {
  cache_id: string;
  texto_extraido: string;
  materia_sugerida_id: string | null;
};

function OrganizeConteudo() {
  const router = useRouter();
  const scanBruto = useLocalStorage("scan_data");
  const imagem = useLocalStorage("scan_image");

  const scan = useMemo<ScanData | null>(() => {
    try {
      return scanBruto ? (JSON.parse(scanBruto) as ScanData) : null;
    } catch {
      return null;
    }
  }, [scanBruto]);

  const [materias, setMaterias] = useState<Materia[]>([]);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    getMaterias()
      .then((ms) => ativo && setMaterias(ms))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  // O texto vem da OCR e pode ser corrigido antes de salvar; a matéria
  // sugerida pela IA já vem marcada.
  const textoInicial = scan?.texto_extraido ?? "";
  const sugerida = scan?.materia_sugerida_id ?? null;
  const [iniciado, setIniciado] = useState(false);
  if (!iniciado && scan) {
    // Inicialização derivada do primeiro render com dados — sem efeito, e
    // portanto sem a renderização em cascata que o setState num efeito causa.
    setTexto(textoInicial);
    setEscolhida(sugerida);
    setIniciado(true);
  }

  async function novaMateria() {
    const nome = prompt("Nome da nova matéria:");
    if (!nome?.trim()) return;
    try {
      const criada = await criarMateria(nome.trim());
      setMaterias((antes) => [...antes, criada]);
      setEscolhida(criada.id);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function confirmar() {
    if (!escolhida || !scan) return;
    setSalvando(true);
    setErro(null);
    try {
      const conteudo = await confirmarConteudo(scan.cache_id, escolhida, texto);
      const materia = materias.find((m) => m.id === escolhida);
      // O ConteudoOut não traz o nome da matéria; anexar aqui evita uma
      // chamada extra só para o cabeçalho do resumo.
      gravarLocalStorage(
        "jovi_last_scan_result",
        JSON.stringify({ ...conteudo, materia_nome: materia?.nome ?? null }),
      );
      avisar("Documento salvo no banco.", "sucesso");
      router.push(`/summary/${conteudo.id}`);
    } catch (e) {
      avisar((e as Error).message, "erro");
      setSalvando(false);
    }
  }

  if (!scan) {
    return (
      <main className="container archive-main">
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.4 }}>
            document_scanner
          </span>
          <p style={{ marginTop: 16, color: "var(--on-surface-variant)" }}>
            Nenhum documento escaneado. Volte à câmera e use o modo SCAN.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <TopHeader titulo="Organizar" />

      <main className="container archive-main">
        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Onde guardar?</h2>
          </div>
        </div>

        {imagem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagem}
            alt="Documento capturado"
            className="doc-original-image"
            style={{ marginBottom: 24 }}
          />
        )}

        <label className="form-label" htmlFor="texto-ocr">
          Texto reconhecido — corrija se precisar
        </label>
        <textarea
          id="texto-ocr"
          className="form-input"
          rows={8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          style={{ width: "100%", marginBottom: 24, resize: "vertical" }}
        />

        <div className="flex items-center justify-between mb-4">
          <h3 className="secao-titulo">Matéria</h3>
          <button type="button" className="link-limpo text-primary" onClick={novaMateria}>
            + Nova
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {materias.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`perfil-opcao${escolhida === m.id ? " selecionado" : ""}`}
              aria-pressed={escolhida === m.id}
              onClick={() => setEscolhida(m.id)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                school
              </span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>{m.nome}</span>
              {m.id === sugerida && (
                <span style={{ fontSize: 9, opacity: 0.6, textTransform: "uppercase" }}>
                  sugerida
                </span>
              )}
            </button>
          ))}
        </div>

        {erro && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginBottom: 16 }}>
            {erro}
          </p>
        )}

        <button
          type="button"
          className={`quiz-gerar${salvando ? " is-loading" : ""}`}
          onClick={confirmar}
          disabled={!escolhida || salvando}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {salvando ? "Buscando vídeos recomendados…" : "Confirmar e salvar"}
        </button>
      </main>
    </>
  );
}

export default function OrganizePage() {
  return (
    <GuardaSessao>
      <OrganizeConteudo />
    </GuardaSessao>
  );
}
