"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopHeader from "@/components/TopHeader";
import {
  getMaterias,
  criarMateria,
  confirmarConteudo,
  criarAula,
  moverConteudoParaLixeira,
  type Materia,
} from "@/lib/api";
import { janelaDeAula } from "@/lib/paginas-aula";
import { useLocalStorage, gravarLocalStorage } from "@/lib/use-local-storage";
import { avisar } from "@/lib/avisos";

type ScanData = {
  cache_id: string;
  texto_extraido: string;
  materia_sugerida_id: string | null;
  conteudo_lixo?: boolean;
  motivo_lixo?: string | null;
};

type AulaPendente = {
  texto: string;
  paginas: number;
  origem?: string;
  video?: string;
  materia_sugerida_id?: string | null;
  recomendado_lixeira?: boolean;
  motivo_lixeira?: string | null;
};

function OrganizeConteudo() {
  const router = useRouter();
  const scanBruto = useLocalStorage("scan_data");
  const imagem = useLocalStorage("scan_image");
  const imagensSalvasBrutas = useLocalStorage("scan_images");

  // Captura em lote: a câmera manda ?aula=1 e deixa o texto já concatenado em
  // `aula_pendente`; as fotos vêm por memória (janelaDeAula), porque data URLs
  // de várias páginas estouram a cota do localStorage.
  const ehAula = useSearchParams().get("aula") === "1";
  const aulaBruta = useLocalStorage("aula_pendente");
  const aula = useMemo(() => {
    try {
      return aulaBruta ? (JSON.parse(aulaBruta) as AulaPendente) : null;
    } catch {
      return null;
    }
  }, [aulaBruta]);

  const imagensLista = useMemo<string[]>(() => {
    try {
      if (imagensSalvasBrutas) {
        const parsed = JSON.parse(imagensSalvasBrutas);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return imagem ? [imagem] : [];
  }, [imagensSalvasBrutas, imagem]);

  const [indiceImagemAtiva, setIndiceImagemAtiva] = useState(0);

  const scan = useMemo<ScanData | null>(() => {
    try {
      return scanBruto ? (JSON.parse(scanBruto) as ScanData) : null;
    } catch {
      return null;
    }
  }, [scanBruto]);

  const [materias, setMaterias] = useState<Materia[]>([]);
  const [escolhidaManual, setEscolhida] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const recomendadoLixeira = Boolean(
    ehAula && aula ? aula.recomendado_lixeira : scan?.conteudo_lixo,
  );
  const motivoLixeira =
    (ehAula && aula ? aula.motivo_lixeira : scan?.motivo_lixo) ||
    "A captura parece vazia, acidental ou sem conteúdo útil de estudo.";
  const [decisaoLixeira, setDecisaoLixeira] = useState<boolean | null>(null);
  const salvarNaLixeira = decisaoLixeira ?? recomendadoLixeira;

  useEffect(() => {
    let ativo = true;
    getMaterias()
      .then((ms) => ativo && setMaterias(ms))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  // Matéria sugerida pela IA (vem do scan individual ou da análise em lote)
  const sugerida = useMemo(() => {
    if (ehAula && aula?.materia_sugerida_id) return aula.materia_sugerida_id;
    return scan?.materia_sugerida_id ?? null;
  }, [ehAula, aula?.materia_sugerida_id, scan?.materia_sugerida_id]);

  const escolhida = escolhidaManual ?? sugerida;
  const textoInicial = ehAula && aula ? aula.texto : scan?.texto_extraido ?? "";
  const texto = textoEditado ?? textoInicial;

  // Ordena para que a matéria sugerida fique no topo
  const materiasOrdenadas = useMemo(() => {
    return [...materias].sort((a, b) => {
      if (a.id === sugerida) return -1;
      if (b.id === sugerida) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [materias, sugerida]);

  const materiasExibidas = mostrarTodas ? materiasOrdenadas : materiasOrdenadas.slice(0, 3);

  async function novaMateria() {
    const nome = prompt("Digite o nome da nova matéria/pasta:");
    if (!nome?.trim()) return;
    try {
      const criada = await criarMateria(nome.trim());
      setMaterias((antes) => [...antes, criada]);
      setEscolhida(criada.id);
      setMostrarTodas(true);
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
        if (salvarNaLixeira) {
          await moverConteudoParaLixeira(conteudo.id);
          avisar("Conteúdo salvo direto na Lixeira. Ele pode ser restaurado.", "sucesso");
          router.push("/library?lixeira=1");
          return;
        }
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
      if (salvarNaLixeira) {
        await moverConteudoParaLixeira(conteudo.id);
        avisar("Documento salvo direto na Lixeira. Ele pode ser restaurado.", "sucesso");
        router.push("/library?lixeira=1");
        return;
      }
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
        {imagensLista.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: 16,
                overflow: "hidden",
                background: "black",
                border: "1px solid rgba(72, 72, 72, 0.3)",
                marginBottom: 12,
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagensLista[indiceImagemAtiva] || imagensLista[0]}
                alt={`Página ${indiceImagemAtiva + 1} da captura`}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />

              {imagensLista.length > 1 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: 12,
                    background: "rgba(0,0,0,0.75)",
                    padding: "4px 8px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  Página {indiceImagemAtiva + 1} de {imagensLista.length}
                </div>
              )}
            </div>

            {/* Miniaturas de todas as fotos para alternar e ver */}
            {imagensLista.length > 1 && (
              <div className="organize-gallery-strip" aria-label="Fotos da aula">
                {imagensLista.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`organize-gallery-thumb${idx === indiceImagemAtiva ? " active" : ""}`}
                    onClick={() => setIndiceImagemAtiva(idx)}
                    title={`Ver página ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Miniatura ${idx + 1}`} />
                    <span className="organize-gallery-num">{idx + 1}</span>
                  </button>
                ))}
              </div>
            )}

            <div
              className="flex items-center gap-2"
              style={{ color: "var(--on-surface-variant)", fontSize: 11, fontWeight: 700 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                data_object
              </span>
              <p style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                {texto ? `Conteúdo detectado (${texto.length} caracteres)` : "Detectando conteúdo…"}
              </p>
            </div>
          </section>
        )}

        <label className="form-label" htmlFor="texto-ocr">
          {ehAula && aula
            ? aula.origem === "transcricao"
              ? "Transcrição da aula — corrija se precisar"
              : `Texto extraído (${aula.paginas} páginas) — corrija se precisar`
            : "Texto extraído — corrija se precisar"}
        </label>
        <textarea
          id="texto-ocr"
          className="form-input"
          rows={6}
          value={texto}
          onChange={(e) => setTextoEditado(e.target.value)}
          style={{ width: "100%", marginBottom: 28, resize: "vertical" }}
        />

        {recomendadoLixeira && (
          <section className="trash-recommendation" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">
              delete_sweep
            </span>
            <div>
              <h2>Recomendação: enviar para a Lixeira</h2>
              <p>{motivoLixeira}</p>
              <label>
                <input
                  type="checkbox"
                  checked={salvarNaLixeira}
                  onChange={(evento) => setDecisaoLixeira(evento.target.checked)}
                />
                Salvar direto na Lixeira (pode ser restaurado depois)
              </label>
            </div>
          </section>
        )}

        <section style={{ marginBottom: 36 }}>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div className="section-title">
              <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>Selecionar Matéria</h2>
                <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginTop: 2 }}>
                  Determine a pasta de destino para este documento.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="link-limpo text-primary"
              onClick={novaMateria}
              title="Criar nova matéria"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                add_box
              </span>
              Nova
            </button>
          </div>

          <div className="materia-list">
            {materiasExibidas.map((m) => {
              const isSuggested = m.id === sugerida;
              const isSelected = m.id === escolhida;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`materia-option${isSelected ? " selected" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => setEscolhida(m.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div className="option-icon">
                      <span className="material-symbols-outlined">folder</span>
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                        {m.nome}
                      </span>
                      {isSuggested && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 8,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "var(--primary)",
                            letterSpacing: "1px",
                          }}
                        >
                          Sugestão IA
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                      check_circle
                    </span>
                  ) : (
                    <span className="material-symbols-outlined" style={{ opacity: 0.3 }}>
                      chevron_right
                    </span>
                  )}
                </button>
              );
            })}

            {!mostrarTodas && materiasOrdenadas.length > 3 && (
              <button
                type="button"
                className="see-more-btn"
                onClick={() => setMostrarTodas(true)}
              >
                Ver mais {materiasOrdenadas.length - 3} pastas
              </button>
            )}
          </div>
        </section>

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
          style={{ width: "100%", justifyContent: "center", padding: "18px" }}
        >
          {salvando ? (
            "Buscando vídeos recomendados…"
          ) : (
            <>
              {salvarNaLixeira ? "Salvar na Lixeira" : "Confirmar e salvar"}
              <span className="material-symbols-outlined" style={{ fontSize: 18, marginLeft: 8 }}>
                folder_shared
              </span>
            </>
          )}
        </button>
      </main>
    </>
  );
}

export default function OrganizePage() {
  return (
    <Suspense
      fallback={
        <main className="container archive-main sem-topbar">
          <div className="loading-container">
            <div className="spinner" />
          </div>
        </main>
      }
    >
      <OrganizeConteudo />
    </Suspense>
  );
}
