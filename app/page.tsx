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
  const [zoomInteragindo, setZoomInteragindo] = useState(false);
  // Páginas da aula em captura. Ficam no aparelho até o aluno concluir.
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [previewPaginaIndex, setPreviewPaginaIndex] = useState<number | null>(null);

  const camera = useCamera();
  const aula = useAula();
  const gravador = useGravador();
  const libras = useLibras(camera.videoRef, modo === "LIBRAS");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestoZoomRef = useRef<{
    pointerId: number;
    inicioX: number;
    inicioY: number;
    zoomInicial: number;
    direcao: "pendente" | "vertical" | "cancelado";
  } | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const zoomPendenteRef = useRef<number | null>(null);
  const zoomOcultarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomMinimo = Math.max(1, camera.capacidadesZoom?.min ?? 1);
  const zoomMaximo = Math.max(zoomMinimo, Math.min(5, camera.capacidadesZoom?.max ?? 5));
  const zoomPasso = Math.max(0.1, camera.capacidadesZoom?.step ?? 0.1);
  const zoomDigital = camera.zoomNativo ? 1 : camera.zoom;
  const zoomProgresso =
    ((camera.zoom - zoomMinimo) / Math.max(zoomMaximo - zoomMinimo, 0.1)) * 100;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zoomOcultarRef.current) clearTimeout(zoomOcultarRef.current);
      if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
    },
    [],
  );

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

  // Zoom de uma mão: o visor aceita somente arraste vertical. Pointer Events
  // cobrem toque, caneta e mouse sem misturar o gesto com a área dos botões.
  function aoIniciarGestoZoom(e: React.PointerEvent<HTMLElement>) {
    if (!e.isPrimary || !camera.pronta || modo === "LIBRAS") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    gestoZoomRef.current = {
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      zoomInicial: camera.zoom,
      direcao: "pendente",
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (zoomOcultarRef.current) clearTimeout(zoomOcultarRef.current);
    setZoomInteragindo(true);
  }

  function aplicarZoomNoProximoFrame(valor: number) {
    zoomPendenteRef.current = valor;
    if (zoomFrameRef.current !== null) return;

    zoomFrameRef.current = requestAnimationFrame(() => {
      zoomFrameRef.current = null;
      const pendente = zoomPendenteRef.current;
      zoomPendenteRef.current = null;
      if (pendente !== null) void camera.ajustarZoom(pendente);
    });
  }

  function aoMoverGestoZoom(e: React.PointerEvent<HTMLElement>) {
    const gesto = gestoZoomRef.current;
    if (!gesto || gesto.pointerId !== e.pointerId || gesto.direcao === "cancelado") return;

    const deltaX = e.clientX - gesto.inicioX;
    const deltaY = gesto.inicioY - e.clientY;

    if (gesto.direcao === "pendente") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
      gesto.direcao = Math.abs(deltaY) >= Math.abs(deltaX) * 1.15 ? "vertical" : "cancelado";
    }
    if (gesto.direcao !== "vertical") return;

    e.preventDefault();
    const percurso = Math.max(180, Math.min(window.innerHeight * 0.42, 320));
    const bruto = gesto.zoomInicial + (deltaY / percurso) * (zoomMaximo - zoomMinimo);
    const limitado = Math.min(zoomMaximo, Math.max(zoomMinimo, bruto));
    const emPassos =
      zoomMinimo + Math.round((limitado - zoomMinimo) / zoomPasso) * zoomPasso;
    aplicarZoomNoProximoFrame(Number(Math.min(zoomMaximo, emPassos).toFixed(3)));
  }

  function aoFinalizarGestoZoom(e: React.PointerEvent<HTMLElement>) {
    if (gestoZoomRef.current?.pointerId !== e.pointerId) return;
    gestoZoomRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    zoomOcultarRef.current = setTimeout(() => setZoomInteragindo(false), 700);
  }

  // Na prévia, arrastar horizontalmente troca de página. Os botões continuam
  // disponíveis para teclado e para quem prefere um alvo explícito.
  const arrastePreviewRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  function aoIniciarArrastePreview(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    arrastePreviewRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function aoFinalizarArrastePreview(e: React.PointerEvent<HTMLDivElement>) {
    const inicio = arrastePreviewRef.current;
    arrastePreviewRef.current = null;
    if (!inicio || inicio.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - inicio.x;
    const deltaY = e.clientY - inicio.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;

    setPreviewPaginaIndex((indice) => {
      if (indice === null) return indice;
      return deltaX < 0
        ? Math.min(indice + 1, paginas.length - 1)
        : Math.max(indice - 1, 0);
    });
  }

  /** Captura de fato: já passou o temporizador e o flash. */
  const disparar = useCallback(async () => {
    const imagem = camera.capturar(0, 0.92, filtroAtual, zoomDigital);
    const miniatura = camera.capturar(320, 0.6, filtroAtual, zoomDigital);
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
  }, [camera, filtroAtual, modo, zoomDigital]);

  /** Flash: lanterna física e clarão de tela sincronizados. */
  const comFlash = useCallback(
    async (acao: () => Promise<void>) => {
      const luminosidade = flash === "auto" ? camera.medirLuminosidade() : null;
      // Se o navegador não permitir ler o quadro, AUTO prefere iluminar a
      // arriscar uma captura escura. Em aparelhos compatíveis, decide localmente.
      const querFlash =
        flash === "on" || (flash === "auto" && (luminosidade === null || luminosidade < 105));
      if (!querFlash) return acao();

      // Tenta acionar a lanterna física. Câmera frontal e navegadores sem
      // suporte recebem o flash branco da própria tela como fallback.
      const ligou = await camera.alternarLanterna(true);
      const usarTela = !ligou || camera.lado === "user";
      if (usarTela) {
        setClarao(true);
        // Garante que o branco foi realmente pintado antes de capturar.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      }
      // A câmera precisa de alguns quadros para ajustar exposição à nova luz.
      await new Promise((r) => setTimeout(r, ligou ? 280 : 140));
      try {
        await acao();
      } finally {
        if (ligou) await camera.alternarLanterna(false);
        if (usarTela) setTimeout(() => setClarao(false), 100);
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
      let paginasAnalisadas = 0;
      let paginasLixo = 0;
      const motivosLixo: string[] = [];
      for (const [i, pagina] of paginas.entries()) {
        setOcupado(`Lendo página ${i + 1} de ${paginas.length}…`);
        setPaginas((antes) => marcarLendo(antes, pagina.id));
        const blob = await (await fetch(pagina.imagem)).blob();
        let texto: string | null = null;
        for (const tentativa of [1, 2]) {
          try {
            const analise = await analisarImagem(blob);
            texto = analise.texto_extraido || "";
            paginasAnalisadas += 1;
            if (analise.conteudo_lixo) {
              paginasLixo += 1;
              if (analise.motivo_lixo) motivosLixo.push(analise.motivo_lixo);
            }
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
      const recomendadoLixeira = paginasAnalisadas > 0 && paginasLixo === paginasAnalisadas;
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
          recomendado_lixeira: recomendadoLixeira,
          motivo_lixeira: recomendadoLixeira
            ? motivosLixo[0] || "A captura parece vazia, acidental ou sem conteúdo útil de estudo."
            : null,
        }),
      );
      if (lidas.length > 0) {
        try {
          if (lidas[0].miniatura) gravarLocalStorage("scan_image", lidas[0].miniatura);
          gravarLocalStorage(
            "scan_images",
            JSON.stringify(lidas.map((p) => p.miniatura || p.imagem)),
          );
        } catch {}
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
        onPointerDown={aoIniciarGestoZoom}
        onPointerMove={aoMoverGestoZoom}
        onPointerUp={aoFinalizarGestoZoom}
        onPointerCancel={aoFinalizarGestoZoom}
      >
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{
            filter: filtroAtual || undefined,
            transform: zoomDigital > 1 ? `scale(${zoomDigital})` : undefined,
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
              <div
                key={p.id}
                className={`tira-item estado-${p.estado}`}
                onClick={() => setPreviewPaginaIndex(i)}
                style={{ cursor: "pointer" }}
                title={`Ver foto da página ${i + 1}`}
              >
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setPaginas((antes) => removerPagina(antes, p.id));
                  }}
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

      {/* Modal de Prévia em Tela Cheia das Fotos Capturadas */}
      {previewPaginaIndex !== null && paginas[previewPaginaIndex] && (
        <div
          className="modal-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Prévia da foto capturada"
          onPointerDown={aoIniciarArrastePreview}
          onPointerUp={aoFinalizarArrastePreview}
          onPointerCancel={() => { arrastePreviewRef.current = null; }}
        >
          <div className="modal-preview-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="material-symbols-outlined text-primary">photo_library</span>
              <strong>
                Página {previewPaginaIndex + 1} de {paginas.length}
              </strong>
            </div>

            <div className="modal-preview-actions">
              <button
                type="button"
                className="chip chip-perigo"
                onClick={() => {
                  const paginaId = paginas[previewPaginaIndex].id;
                  setPaginas((antes) => removerPagina(antes, paginaId));
                  if (paginas.length <= 1) {
                    setPreviewPaginaIndex(null);
                  } else if (previewPaginaIndex >= paginas.length - 1) {
                    setPreviewPaginaIndex(paginas.length - 2);
                  }
                }}
                title="Descartar esta foto"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  delete
                </span>
                Excluir
              </button>

              <button
                type="button"
                className="chip"
                onClick={() => setPreviewPaginaIndex(null)}
                aria-label="Fechar prévia"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  close
                </span>
              </button>
            </div>
          </div>

          <div className="modal-preview-body">
            {previewPaginaIndex > 0 && (
              <button
                type="button"
                className="modal-preview-nav-btn prev"
                onClick={() => setPreviewPaginaIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                aria-label="Página anterior"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paginas[previewPaginaIndex].imagem}
              alt={`Foto da página ${previewPaginaIndex + 1}`}
              className="modal-preview-img"
            />

            {previewPaginaIndex < paginas.length - 1 && (
              <button
                type="button"
                className="modal-preview-nav-btn next"
                onClick={() =>
                  setPreviewPaginaIndex((i) => (i !== null && i < paginas.length - 1 ? i + 1 : i))
                }
                aria-label="Próxima página"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            )}

            {paginas.length > 1 && (
              <span className="modal-preview-swipe-hint" aria-hidden="true">
                Arraste para ver a página anterior ou a próxima
              </span>
            )}
          </div>

          <div className="modal-preview-footer">
            <button
              type="button"
              className="chip"
              onClick={() => setPreviewPaginaIndex(null)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                add_a_photo
              </span>
              Tirar mais fotos
            </button>

            <button
              type="button"
              className="chip chip-primario"
              onClick={() => {
                setPreviewPaginaIndex(null);
                void concluirAula();
              }}
              disabled={Boolean(ocupado)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                check_circle
              </span>
              Concluir ({paginas.length} páginas)
            </button>
          </div>
        </div>
      )}

      {/* Deck inferior com layout flexbox fluido que não sobrepõe em nenhuma tela */}
      <div className="camera-bottom-deck">
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

          <div
            className={`shutter-zoom-control${zoomInteragindo ? " is-adjusting" : ""}${
              camera.pronta && modo !== "LIBRAS" ? " has-zoom" : ""
            }`}
            style={{ "--zoom-progress": `${Math.min(100, Math.max(0, zoomProgresso))}%` } as React.CSSProperties}
          >
            <span className="shutter-zoom-ring" aria-hidden="true" />
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
            {camera.pronta && modo !== "LIBRAS" && (
              <output className="shutter-zoom-readout" aria-label="Zoom atual" aria-live="off">
                <strong>{camera.zoom.toFixed(1)}×</strong>
              </output>
            )}
          </div>

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
