"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import {
  AJUSTES_PADRAO,
  GavetaAjustes,
  GavetaFlash,
  GavetaQualidade,
  type Ajustes,
  type Gaveta,
} from "@/components/CameraDrawers";
import { useCamera, type ModoFlash } from "@/lib/use-camera";
import { useAula } from "@/lib/use-aula";
import { useGravador } from "@/lib/use-gravador";
import { useLibras } from "@/lib/use-libras";
import { analisarImagem } from "@/lib/api";
import {
  criarPagina, marcarTexto, marcarLendo, marcarFalha, removerPagina, textoDaAula, janelaDeAula,
  type Pagina,
} from "@/lib/paginas-aula";
import { adicionarVideo, salvarTranscricao } from "@/lib/video-library";
import { gravarLocalStorage, useLocalStorage } from "@/lib/use-local-storage";
import { avisar } from "@/lib/avisos";
import { CHAVE_PERFIL, temPerfil } from "@/lib/perfil";

type Modo = "FOTO" | "VÍDEO" | "SCAN" | "LIBRAS" | "AULA";
const MODOS: Modo[] = ["FOTO", "VÍDEO", "SCAN", "LIBRAS", "AULA"];

const FILTRO_REALCE = "contrast(1.35) brightness(1.08) saturate(0.9)";

/**
 * Quantos segundos esperar antes de tentar de novo. A mensagem de cota do
 * Gemini traz "Please retry in 37.8s"; sem isso, 3s de cortesia. O teto de 45s
 * evita prender o aluno numa tela de espera indefinida.
 */
function segundosParaTentarDeNovo(mensagem: string): number {
  const achado = /retry in ([\d.]+)s/i.exec(mensagem || "");
  const pedido = achado ? Math.ceil(Number(achado[1])) : 3;
  return Math.min(Math.max(pedido, 3), 45);
}

function formatarTempo(segundos: number): string {
  const m = String(Math.floor(segundos / 60)).padStart(2, "0");
  const s = String(segundos % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function CameraConteudo() {
  const router = useRouter();
  // Perfil surdo abre direto em LIBRAS — é o que a tela de Ajustes promete.
  // Vai no estado inicial, e não num efeito, para a câmera não piscar em SCAN
  // antes de trocar.
  const perfil = useLocalStorage(CHAVE_PERFIL);
  const [modo, setModo] = useState<Modo>(temPerfil(perfil, "surdo") ? "LIBRAS" : "SCAN");
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_PADRAO);
  const [flash, setFlash] = useState<ModoFlash>("off");
  const [intensidadeFlash, setIntensidadeFlash] = useState(100);
  const [clarao, setClarao] = useState(false);
  const [contagem, setContagem] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ultimaFoto, setUltimaFoto] = useState<string | null>(null);
  const [focando, setFocando] = useState(false);
  const [segundosVideo, setSegundosVideo] = useState(0);
  // Páginas da aula em captura. Ficam no aparelho até o aluno concluir.
  const [paginas, setPaginas] = useState<Pagina[]>([]);

  const camera = useCamera();
  const aula = useAula();
  const gravador = useGravador();
  const libras = useLibras(camera.videoRef, modo === "LIBRAS");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Cronômetro do modo VÍDEO. O relógio é o sistema externo: o efeito só o
  // liga e desliga, e o setState mora no callback dele.
  useEffect(() => {
    if (!gravador.gravandoVideo) return;
    const inicio = Date.now();
    const timer = setInterval(() => setSegundosVideo(Math.floor((Date.now() - inicio) / 1000)), 500);
    return () => clearInterval(timer);
  }, [gravador.gravandoVideo]);

  // O hook da aula reporta troca de motor e falhas pelo próprio estado; daqui
  // eles viram aviso na tela como qualquer outro.
  useEffect(() => {
    if (aula.aviso) avisar(aula.aviso, "info");
  }, [aula.aviso]);

  useEffect(() => {
    if (aula.erro) avisar(aula.erro, "erro");
  }, [aula.erro]);

  // Fechar a aba com páginas capturadas perderia a aula inteira: as fotos só
  // vivem em memória até o envio.
  useEffect(() => {
    if (paginas.length === 0) return;
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [paginas.length]);

  const filtroAtual = ajustes.realce ? FILTRO_REALCE : "";

  // Suporte a gesto de pinça (pinch-to-zoom) no celular
  const toquePincaRef = useRef<{ dist: number; zoomInicial: number } | null>(null);

  function aoTocarInicio(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      toquePincaRef.current = { dist, zoomInicial: camera.zoom };
    }
  }

  function aoTocarMover(e: React.TouchEvent) {
    if (e.touches.length === 2 && toquePincaRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (toquePincaRef.current.dist > 0) {
        const fator = dist / toquePincaRef.current.dist;
        const novoZoom = Math.min(5, Math.max(1, toquePincaRef.current.zoomInicial * fator));
        camera.ajustarZoom(Number(novoZoom.toFixed(1)));
      }
    }
  }

  function aoTocarFim() {
    toquePincaRef.current = null;
  }

  /** Captura de fato: já passou o temporizador e o flash. */
  const disparar = useCallback(async () => {
    const imagem = camera.capturar(0, 0.92, filtroAtual, camera.zoom);
    const miniatura = camera.capturar(320, 0.6, filtroAtual, camera.zoom);
    if (!imagem) {
      avisar("A câmera ainda não está pronta.", "info");
      return;
    }
    setUltimaFoto(miniatura);

    if (modo === "FOTO") {
      gravarLocalStorage("jovi_ultima_foto", miniatura ?? imagem);
      avisar("Foto salva.", "sucesso");
      return;
    }

    // SCAN acumula páginas e não toca na rede: a leitura acontece ao concluir.
    // Lendo durante a captura, quatro fotos seguidas viravam quatro chamadas
    // de IA simultâneas e o Gemini derrubava as excedentes com 502.
    setPaginas((antes) => [...antes, criarPagina(imagem, miniatura ?? imagem)]);
  }, [camera, filtroAtual, modo]);

  /** Flash: lanterna física e clarão de tela sincronizados. */
  const comFlash = useCallback(
    async (acao: () => Promise<void>) => {
      const querFlash = flash === "on" || flash === "auto";
      if (!querFlash) return acao();

      // Tenta acionar a lanterna de hardware
      const ligou = await camera.alternarLanterna(true);
      // Sempre ativa o clarão visual de tela cheia para iluminação máxima
      setClarao(true);
      // Um instante para a cena receber a luz antes do quadro ser lido.
      await new Promise((r) => setTimeout(r, 220));
      try {
        await acao();
      } finally {
        if (ligou) await camera.alternarLanterna(false);
        setTimeout(() => setClarao(false), 150);
      }
    },
    [camera, flash],
  );

  /** Lê as páginas e envia a aula. Só aqui a captura em lote toca na rede. */
  async function concluirAula() {
    if (!paginas.length || ocupado) return;

    try {
      // Uma de cada vez, na ordem: em paralelo o Gemini responde 502 nas
      // excedentes. Uma segunda tentativa cobre o 503 passageiro dele.
      let lidas = paginas;
      let materiaSugeridaId: string | null = null;
      for (const [i, pagina] of paginas.entries()) {
        setOcupado(`Lendo página ${i + 1} de ${paginas.length}…`);
        setPaginas((antes) => marcarLendo(antes, pagina.id));
        const blob = await (await fetch(pagina.imagem)).blob();
        let texto: string | null = null;
        for (const tentativa of [1, 2]) {
          try {
            const analise = await analisarImagem(blob);
            texto = analise.texto_extraido || "";
            if (analise.materia_sugerida_id && !materiaSugeridaId) {
              materiaSugeridaId = analise.materia_sugerida_id;
            }
            break;
          } catch (e) {
            console.warn(`OCR da página ${i + 1} falhou (tentativa ${tentativa}):`, e);
            if (tentativa === 2) break;
            // A cota gratuita do Gemini é de 20 chamadas por minuto, e o erro
            // 429 informa quantos segundos faltam. Esperar 1s e tentar de novo
            // só queimaria a segunda tentativa à toa.
            const espera = segundosParaTentarDeNovo((e as Error).message);
            setOcupado(
              espera > 3
                ? `Limite da IA atingido. Retomando a página ${i + 1} em ${espera}s…`
                : `Lendo página ${i + 1} de novo…`,
            );
            await new Promise((r) => setTimeout(r, espera * 1000));
            setOcupado(`Lendo página ${i + 1} de ${paginas.length}…`);
          }
        }
        lidas = texto === null ? marcarFalha(lidas, pagina.id) : marcarTexto(lidas, pagina.id, texto);
        setPaginas(lidas);
      }

      const falhas = lidas.filter((p) => p.estado === "falhou").length;
      if (falhas === lidas.length) {
        avisar(
          "Nenhuma página pôde ser lida — a cota gratuita da IA (20 leituras por minuto) " +
            "provavelmente estourou. As fotos continuam aqui: espere um minuto e conclua de novo.",
          "erro",
        );
        return;
      }
      if (falhas) avisar(`${falhas} de ${lidas.length} páginas não puderam ser lidas.`, "info");

      setOcupado(`Salvando ${lidas.length} páginas…`);
      // As imagens são data URLs; o backend recebe binário.
      const blobs = await Promise.all(
        lidas.map(async (p) => (await fetch(p.imagem)).blob()),
      );
      gravarLocalStorage(
        "aula_pendente",
        JSON.stringify({
          texto: textoDaAula(lidas),
          paginas: blobs.length,
          materia_sugerida_id: materiaSugeridaId,
        }),
      );
      if (lidas.length > 0 && lidas[0].miniatura) {
        try {
          gravarLocalStorage("scan_image", lidas[0].miniatura);
        } catch (_) {}
      }
      // A escolha da matéria continua na tela de organizar; guardamos as
      // imagens aqui até lá.
      janelaDeAula.blobs = blobs;
      router.push("/organize?aula=1");
    } catch (e) {
      // Falhou o envio: as páginas continuam na tira, nada se perde.
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function aoDisparar() {
    setGaveta(null);

    if (modo === "AULA") {
      if (aula.gravando) return encerrarAula();
      await aula.iniciar();
      await gravador.iniciar(camera.obterStream());
      return;
    }

    if (modo === "LIBRAS") {
      libras.falar();
      return;
    }

    if (modo === "VÍDEO") {
      if (gravador.gravandoVideo) return encerrarVideo();
      if (!(await gravador.iniciar(camera.obterStream()))) {
        avisar("Este navegador não consegue gravar vídeo.", "erro");
      }
      return;
    }

    if (ajustes.timer > 0) {
      // Temporizador de verdade: conta na tela e só então dispara.
      let restante = ajustes.timer;
      setContagem(restante);
      const tick = () => {
        restante -= 1;
        setContagem(restante);
        if (restante > 0) {
          timerRef.current = setTimeout(tick, 1000);
        } else {
          timerRef.current = null;
          comFlash(disparar);
        }
      };
      timerRef.current = setTimeout(tick, 1000);
      return;
    }

    await comFlash(disparar);
  }

  /** Encerra a aula: salva o vídeo com a legenda que a própria aula gerou. */
  async function encerrarAula() {
    const falas = aula.falas;
    const duracao = aula.segundos;
    aula.encerrar();

    setOcupado("Salvando a aula…");
    try {
      const arquivo = await gravador.parar();
      if (!arquivo) {
        avisar(
          falas.length
            ? "Aula encerrada. O vídeo não pôde ser gravado neste navegador."
            : "Aula encerrada sem falas reconhecidas.",
          "info",
        );
        return;
      }
      const item = await adicionarVideo(arquivo, duracao);
      // Os trechos que a aula já transcreveu viram a legenda do vídeo — não há
      // uma segunda passada de transcrição depois.
      const texto = falas.map((f) => f.texto).join(" ").trim();
      if (falas.length) {
        await salvarTranscricao(item.id, {
          language: "pt-BR",
          text: texto,
          segments: falas.map((f, i) => ({
            start: f.segundo,
            end: falas[i + 1]?.segundo ?? f.segundo + 4,
            text: f.texto,
          })),
        });
      }

      // A transcrição também vira documento no banco: é o que dá resumo e
      // quiz da aula. Sem falas não há o que resumir — aí só o vídeo importa.
      if (texto) {
        const capa = camera.capturar(0, 0.9, "");
        if (capa) {
          janelaDeAula.blobs = [await (await fetch(capa)).blob()];
          gravarLocalStorage(
            "aula_pendente",
            JSON.stringify({ texto, paginas: 1, origem: "transcricao", video: item.id }),
          );
          avisar("Vídeo salvo na galeria. Escolha a matéria para guardar a transcrição.", "sucesso");
          router.push("/organize?aula=1");
          return;
        }
      }

      router.push(`/player/${item.id}`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Encerra a gravação simples. Diferente da AULA, aqui não há transcrição ao
   * vivo — o vídeo entra na galeria sem legenda, e o player oferece gerá-la
   * sob demanda pelo microserviço.
   */
  async function encerrarVideo() {
    setOcupado("Salvando o vídeo…");
    try {
      const arquivo = await gravador.parar();
      if (!arquivo) {
        avisar("Nada foi gravado.", "erro");
        return;
      }
      const item = await adicionarVideo(arquivo, segundosVideo);
      router.push(`/player/${item.id}`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  function focar() {
    setFocando(true);
    setTimeout(() => setFocando(false), 900);
    setGaveta(null);
  }

  const gravandoAula = modo === "AULA" && aula.gravando;
  const gravandoVideo = modo === "VÍDEO" && gravador.gravandoVideo;
  const ocupadoComGravacao = gravandoAula || gravandoVideo;
  const resumoQualidade = `${camera.resolucao === "4K" ? "4K" : "1080p"} • ${camera.fps}FPS`;

  return (
    <div className="camera-container">
      <header className="top-header">
        <button
          type="button"
          className="text-primary"
          onClick={() => setGaveta((g) => (g === "flash" ? null : "flash"))}
          aria-expanded={gaveta === "flash"}
          aria-label="Flash"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <span className="material-symbols-outlined">
            {flash === "off" ? "flash_off" : flash === "auto" ? "flash_auto" : "flash_on"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setGaveta((g) => (g === "qualidade" ? null : "qualidade"))}
          aria-expanded={gaveta === "qualidade"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: "var(--on-surface-variant)",
            opacity: 0.7,
          }}
        >
          {gravandoAula
            ? aula.tempoFormatado
            : gravandoVideo
              ? formatarTempo(segundosVideo)
              : camera.pronta
                ? resumoQualidade
                : "INICIANDO…"}
        </button>

        <button
          type="button"
          onClick={() => setGaveta((g) => (g === "ajustes" ? null : "ajustes"))}
          aria-expanded={gaveta === "ajustes"}
          aria-label="Configurações da câmera"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}
        >
          <span className="material-symbols-outlined">tune</span>
        </button>
      </header>

      {gaveta === "ajustes" && (
        <GavetaAjustes ajustes={ajustes} onMudar={setAjustes} onFocar={focar} />
      )}
      {gaveta === "flash" && (
        <GavetaFlash
          modo={flash}
          onModo={setFlash}
          intensidade={intensidadeFlash}
          onIntensidade={setIntensidadeFlash}
          disponivel={camera.temLanterna}
        />
      )}
      {gaveta === "qualidade" && (
        <GavetaQualidade
          resolucao={camera.resolucao}
          onResolucao={camera.setResolucao}
          fps={camera.fps}
          onFps={camera.setFps}
          real={camera.real}
        />
      )}

      <main
        className="camera-main"
        onClick={() => gaveta && setGaveta(null)}
        onTouchStart={aoTocarInicio}
        onTouchMove={aoTocarMover}
        onTouchEnd={aoTocarFim}
      >
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{
            filter: filtroAtual || undefined,
            transform: camera.zoom > 1 ? `scale(${camera.zoom})` : undefined,
            transformOrigin: "center center",
            transition: "transform 0.1s ease-out",
          }}
        />

        {modo === "LIBRAS" && (
          <canvas ref={libras.canvasRef} className="landmarks-canvas" aria-hidden="true" />
        )}

        <div className={`proporcao-${ajustes.proporcao.replace(":", "-")} viewfinder-overlay`}>
          {ajustes.grade && <div className="camera-grid-overlay" aria-hidden="true" />}
          {modo === "SCAN" && <div className="scan-frame" aria-hidden="true" />}
          {focando && <div className="foco-anel" aria-hidden="true" />}

          {gravandoVideo && (
            <div className="gravando-selo" role="status">
              <span className="aula-ponto" aria-hidden="true" />
              REC {formatarTempo(segundosVideo)}
            </div>
          )}

          {gravandoAula && (
            <div className="aula-legenda" aria-live="polite">
              {aula.parcial || aula.ultimaFala || "Ouvindo…"}
            </div>
          )}
        </div>

        {contagem > 0 && <div className="contagem-regressiva">{contagem}</div>}

        {/* Flash de tela para aparelhos sem lanterna. */}
        {clarao && (
          <div
            className="clarao-flash"
            style={{ opacity: intensidadeFlash / 100 }}
            aria-hidden="true"
          />
        )}

        {camera.erro && (
          <div className="loading-overlay" role="alert">
            <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.5 }}>
              videocam_off
            </span>
            <p style={{ maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>{camera.erro}</p>
          </div>
        )}

        {ocupado && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>{ocupado}</p>
          </div>
        )}
      </main>

      {modo === "LIBRAS" && (
        <div className="libras-barra">
          <div className="libras-leitura">
            <span className="libras-letra">{libras.letra ?? "--"}</span>
            <span className="libras-conf">
              {libras.carregando
                ? "Carregando rastreamento…"
                : libras.erro
                  ? libras.erro
                  : libras.letra
                    ? `${Math.round(libras.confianca * 100)}% de confiança`
                    : libras.emMovimento
                      ? "Em movimento"
                      : "Aguardando leitura"}
            </span>
          </div>

          <p className="libras-frase" aria-live="polite">
            {libras.frase || "Soletre com a mão para formar a frase…"}
          </p>

          <div className="libras-acoes">
            <button type="button" onClick={libras.falar} disabled={!libras.frase} title="Falar a frase">
              <span className="material-symbols-outlined">volume_up</span>
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(libras.frase)}
              disabled={!libras.frase}
              title="Copiar a frase"
            >
              <span className="material-symbols-outlined">content_copy</span>
            </button>
            <button type="button" onClick={libras.apagarUltima} disabled={!libras.frase} title="Apagar a última letra">
              <span className="material-symbols-outlined">backspace</span>
            </button>
            <button type="button" onClick={libras.limpar} disabled={!libras.frase} title="Limpar tudo" className="acao-perigo">
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      )}

      {gravandoAula && (
        <div className="aula-barra">
          <span className="aula-ponto" aria-hidden="true" />
          <span className="aula-tempo">{aula.tempoFormatado}</span>
          <span className="aula-trechos" role="status" aria-live="polite">
            {aula.falas.length} falas
            {aula.motor === "backend" ? " · via servidor" : ""}
            {gravador.gravandoVideo ? " · gravando vídeo" : ""}
          </span>
          <button type="button" className="aula-encerrar" onClick={encerrarAula}>
            Encerrar aula
          </button>
        </div>
      )}

      {modo === "SCAN" && paginas.length > 0 && (
        <div className="tira-paginas">
          <div className="tira-lista">
            {paginas.map((p, i) => (
              <div key={p.id} className={`tira-item estado-${p.estado}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.miniatura} alt={`Página ${i + 1}`} />
                <span className="tira-numero">{i + 1}</span>
                {p.estado === "lendo" && <span className="tira-spinner" aria-hidden="true" />}
                {p.estado === "falhou" && (
                  <span className="material-symbols-outlined tira-alerta" title="Não foi possível ler">
                    error
                  </span>
                )}
                <button
                  type="button"
                  className="tira-remover"
                  onClick={() => setPaginas((antes) => removerPagina(antes, p.id))}
                  aria-label={`Descartar página ${i + 1}`}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="tira-concluir"
            onClick={concluirAula}
            disabled={Boolean(ocupado)}
          >
            {ocupado ? "Lendo…" : `Concluir (${paginas.length})`}
          </button>
        </div>
      )}

      <div className="camera-mode-selector">
        {MODOS.map((m) => (
          <button
            key={m}
            type="button"
            className={`mode-btn ${modo === m ? "mode-active" : "mode-inactive"}`}
            aria-pressed={modo === m}
            disabled={ocupadoComGravacao && m !== modo}
            onClick={() => {
              if (
                paginas.length > 0 &&
                m !== modo &&
                !confirm(`Descartar as ${paginas.length} páginas capturadas?`)
              ) {
                return;
              }
              if (m !== modo) setPaginas([]);
              setModo(m);
              setGaveta(null);
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Pílulas rápidas de Zoom (1x / 2x / 3x / 5x) */}
      {camera.pronta && (
        <div className="camera-zoom-pills" role="toolbar" aria-label="Controle de Zoom">
          {[1, 2, 3, 5].map((z) => (
            <button
              key={z}
              type="button"
              className={`zoom-pill${Math.round(camera.zoom) === z ? " active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                camera.ajustarZoom(z);
              }}
              aria-label={`Zoom ${z} vezes`}
            >
              {z}x
            </button>
          ))}
        </div>
      )}

      <div className="camera-shutter-control">
        <Link href="/library" className="thumbnail-preview" aria-label="Abrir biblioteca">
          {ultimaFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ultimaFoto} alt="" />
          ) : (
            <span className="material-symbols-outlined" style={{ opacity: 0.3, color: "#fff" }}>
              photo_library
            </span>
          )}
        </Link>

        <button
          type="button"
          className="shutter-button"
          onClick={aoDisparar}
          disabled={!!ocupado || contagem > 0 || (!camera.pronta && modo !== "AULA")}
          aria-label={
            modo === "AULA"
              ? aula.gravando
                ? "Encerrar aula"
                : "Iniciar aula"
              : modo === "VÍDEO"
                ? gravandoVideo
                  ? "Parar gravação"
                  : "Gravar vídeo"
                : modo === "LIBRAS"
                  ? "Falar a frase montada"
                  : "Capturar"
          }
        >
          <div className="shutter-outer">
            <div className={`shutter-inner${ocupadoComGravacao ? " recording" : ""}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                {modo === "AULA"
                  ? aula.gravando
                    ? "stop"
                    : "mic"
                  : modo === "VÍDEO"
                    ? gravandoVideo
                      ? "stop"
                      : "videocam"
                    : modo === "LIBRAS"
                      ? "campaign"
                      : "photo_camera"}
              </span>
            </div>
          </div>
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={camera.trocarLado}
            aria-label={
              camera.lado === "environment" ? "Usar câmera frontal" : "Usar câmera traseira"
            }
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "none",
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
            }}
          >
            <span className="material-symbols-outlined">flip_camera_android</span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function HomePage() {
  return (
    <GuardaSessao>
      <CameraConteudo />
    </GuardaSessao>
  );
}
