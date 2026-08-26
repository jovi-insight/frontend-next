"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import { getMaterias, criarMateria, confirmarConteudo, criarAula, type Materia } from "@/lib/api";
import { janelaDeAula } from "@/lib/paginas-aula";
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

  // Captura em lote: a câmera manda ?aula=1 e deixa o texto já concatenado em
  // `aula_pendente`; as fotos vêm por memória (janelaDeAula), porque data URLs
  // de várias páginas estouram a cota do localStorage.
  const ehAula = useSearchParams().get("aula") === "1";
  const aulaBruta = useLocalStorage("aula_pendente");
  const aula = useMemo(() => {
    try {
      return aulaBruta
        ? (JSON.parse(aulaBruta) as {
            texto: string;
            paginas: number;
            /** "transcricao" = Modo Aula; ausente = fotos do quadro. */
            origem?: string;
            video?: string;
          })
        : null;
    } catch {
      return null;
    }
  }, [aulaBruta]);

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
  if (!iniciado && (scan || (ehAula && aula))) {
    // Inicialização derivada do primeiro render com dados — sem efeito, e
    // portanto sem a renderização em cascata que o setState num efeito causa.
    setTexto(ehAula && aula ? aula.texto : textoInicial);
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
      avisar("Nova matéria criada com sucesso!", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
      setErro((e as Error).message);
    }
  }

  async function confirmar() {
    if (!escolhida || !(scan || (ehAula && aula))) return;
    setSalvando(true);
    setErro(null);
    try {
      if (ehAula && aula) {
        // As imagens vivem em memória: recarregar esta página as perde, e a
        // rota exige ao menos uma. O texto continua aqui (localStorage), então
        // a mensagem precisa dizer que só a imagem se foi.
        if (janelaDeAula.blobs.length === 0) {
          throw new Error(
            aula.origem === "transcricao"
              ? "A imagem da aula se perdeu ao recarregar a página. Grave a aula de novo."
              : "As fotos da aula se perderam ao recarregar a página. Capture de novo.",
          );
        }
        const conteudo = await criarAula(janelaDeAula.blobs, escolhida, texto);
        const materia = materias.find((m) => m.id === escolhida);
        gravarLocalStorage(
          "jovi_last_scan_result",
          JSON.stringify({ ...conteudo, materia_nome: materia?.nome ?? null }),
        );
        janelaDeAula.blobs = [];
        avisar(
          aula.origem === "transcricao"
            ? "Aula salva. O resumo sai da transcrição inteira."
            : `Aula salva com ${aula.paginas} páginas.`,
          "sucesso",
        );
        router.push(`/summary/${conteudo.id}`);
        return;
      }
      if (!scan) return;
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

  if (!scan && !(ehAula && aula)) {
    return (
      <main className="container archive-main">
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.4 }}>
            document_scanner
          </span>
          <p style={{ marginTop: 16, color: "var(--on-surface-variant)" }}>
            Nenhum documento escaneado. Volte à câmera e use o modo SCAN.
          </p>
          {/* Sem isto a tela vazia não tem saída: aqui não há barra inferior. */}
          <Link href="/" className="focus-link" style={{ marginTop: 20 }}>
            Ir para a câmera
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <TopHeader titulo="Organizar" voltarPara="/" />

      <main className="container archive-main">
        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>{ehAula && aula?.origem === "transcricao" ? "Guardar a aula" : "Onde guardar?"}</h2>
          </div>
        </div>

        {imagem && !ehAula && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagem}
            alt="Documento capturado"
            className="doc-original-image"
            style={{ marginBottom: 24 }}
          />
        )}

        <label className="form-label" htmlFor="texto-ocr">
          {ehAula && aula
            ? aula.origem === "transcricao"
              ? "Transcrição da aula — corrija se precisar"
              : `Texto de ${aula.paginas} páginas — corrija se precisar`
            : "Texto reconhecido — corrija se precisar"}
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
