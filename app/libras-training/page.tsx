"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import { avisar } from "@/lib/avisos";
import {
  descreverAtualizacaoAutomatica,
  type StatusAtualizacaoAutomatica,
} from "@/lib/libras-auto-training";
import {
  enviarAmostrasLetra,
  obterResumoDataset,
  statusModelo,
  type ResumoDataset,
} from "@/lib/libras-ml";
import { useCamera } from "@/lib/use-camera";
import { useLibras, type Landmark } from "@/lib/use-libras";

const LETRAS_ESTATICAS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
const ALVO_AMOSTRAS = 45;
const MINIMO_POR_LETRA = 20;

const DICAS: Partial<Record<string, string>> = {
  A: "Feche o punho, deixe o polegar ao lado do indicador e mostre a palma.",
  F: "Encoste polegar e indicador em círculo; deixe os outros dedos abertos.",
  G: "Aponte apenas o indicador para cima e mantenha o polegar dobrado.",
  H: "Estenda indicador e médio juntos e deixe a palma de lado para a câmera.",
  K: "Abra indicador e médio e encoste o polegar na articulação do dedo médio.",
  L: "Forme um L com indicador e polegar; recolha os outros três dedos.",
  M: "Aponte indicador, médio e anelar juntos para baixo.",
  N: "Aponte indicador e médio juntos para baixo; recolha os demais.",
  P: "Aponte indicador e médio para o lado e mantenha os demais recolhidos.",
  V: "Mostre a palma e abra indicador e médio em V.",
  X: "Curve apenas o indicador em gancho; mantenha polegar e os outros dedos recolhidos.",
  Y: "Estenda polegar e mínimo bem afastados; recolha indicador, médio e anelar.",
};

type Modelo = Awaited<ReturnType<typeof statusModelo>>;
type FaseColeta = "parado" | "contagem" | "capturando" | "enviando";

function aguardar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function idPersistente(): string {
  const chave = "jovi.libras.userId";
  const salvo = localStorage.getItem(chave);
  if (salvo) return salvo;
  const parte = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const novo = `pwa-${parte}`;
  localStorage.setItem(chave, novo);
  return novo;
}

function idSessao(letra: string): string {
  const parte = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `treino-${letra}-${parte}`;
}

function dicaDaLetra(letra: string): string {
  return DICAS[letra] ?? `Faça a letra ${letra} e mantenha a mão inteira dentro do quadro.`;
}

function orientacaoDaColeta(coletadas: number): string {
  if (coletadas < 15) return "Mantenha a mão centralizada";
  if (coletadas < 30) return "Gire a mão levemente para a esquerda";
  return "Agora gire levemente para a direita";
}

function TreinamentoLibrasConteudo() {
  const {
    videoRef,
    lado,
    pronta: cameraPronta,
    erro: cameraErro,
    trocarLado,
  } = useCamera(true, "user");
  const {
    canvasRef,
    maoDetectada,
    obterQuadro,
    carregando: rastreamentoCarregando,
    erro: rastreamentoErro,
    tentarNovamente: tentarRastreamentoNovamente,
    adicionarAmostraCalibracao,
    finalizarCalibracao,
  } = useLibras(videoRef, true, false, true);
  const [letra, setLetra] = useState("F");
  const [dataset, setDataset] = useState<ResumoDataset | null>(null);
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [fase, setFase] = useState<FaseColeta>("parado");
  const [regressiva, setRegressiva] = useState(0);
  const [coletadas, setColetadas] = useState(0);
  const [mensagemColeta, setMensagemColeta] = useState(dicaDaLetra("F"));
  const [autoTreino, setAutoTreino] = useState<StatusAtualizacaoAutomatica>();

  const execucaoRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const concluirLoopRef = useRef<(() => void) | null>(null);

  const atualizarStatus = useCallback(async () => {
    setCarregandoStatus(true);
    const [datasetResult, modeloResult] = await Promise.allSettled([
      obterResumoDataset(),
      statusModelo(),
    ]);

    if (datasetResult.status === "fulfilled") setDataset(datasetResult.value);
    if (modeloResult.status === "fulfilled") setModelo(modeloResult.value);

    const falha = [datasetResult, modeloResult].find((resultado) => resultado.status === "rejected");
    setErroStatus(
      falha?.status === "rejected"
        ? (falha.reason as Error).message || "Não foi possível consultar o treinamento."
        : null,
    );
    setCarregandoStatus(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void atualizarStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [atualizarStatus]);

  const interromperColeta = useCallback((avisarCancelamento = true) => {
    execucaoRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    concluirLoopRef.current?.();
    concluirLoopRef.current = null;
    setFase("parado");
    setRegressiva(0);
    setColetadas(0);
    if (avisarCancelamento) setMensagemColeta("Coleta cancelada. Você pode começar novamente.");
  }, []);

  useEffect(
    () => () => {
      execucaoRef.current += 1;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      concluirLoopRef.current?.();
    },
    [],
  );

  async function iniciarColeta() {
    if (fase !== "parado") return;
    if (!cameraPronta) {
      avisar(cameraErro || "A câmera ainda não está pronta.", "info");
      return;
    }
    if (rastreamentoCarregando) {
      avisar("O rastreamento da mão ainda está carregando.", "info");
      return;
    }
    if (rastreamentoErro) {
      avisar(rastreamentoErro, "erro");
      return;
    }

    const minhaExecucao = execucaoRef.current + 1;
    execucaoRef.current = minhaExecucao;
    setColetadas(0);
    setFase("contagem");
    setMensagemColeta(`Prepare a letra ${letra} e mantenha a mão no quadro.`);

    for (let numero = 3; numero > 0; numero -= 1) {
      setRegressiva(numero);
      await aguardar(850);
      if (execucaoRef.current !== minhaExecucao) return;
    }

    setRegressiva(0);
    setFase("capturando");
    setMensagemColeta("Procurando a mão inteira no quadro…");

    const amostras: Landmark[][] = [];
    let ultimoQuadro = -1;
    let ultimaAmostraEm = 0;

    await new Promise<void>((resolve) => {
      concluirLoopRef.current = resolve;

      const passo = (agora: number) => {
        if (execucaoRef.current !== minhaExecucao) {
          concluirLoopRef.current = null;
          resolve();
          return;
        }

        const quadro = obterQuadro();
        const quadroNovo = quadro && quadro.capturadoEm !== ultimoQuadro;
        if (quadroNovo && agora - ultimaAmostraEm >= 75) {
          ultimoQuadro = quadro.capturadoEm;
          ultimaAmostraEm = agora;
          amostras.push(quadro.landmarks);
          const total = amostras.length;
          setColetadas(total);
          setMensagemColeta(orientacaoDaColeta(total));

          if (total >= ALVO_AMOSTRAS) {
            frameRef.current = null;
            concluirLoopRef.current = null;
            resolve();
            return;
          }
        } else if (!quadro) {
          setMensagemColeta("Mão fora do quadro — centralize para continuar.");
        }

        frameRef.current = requestAnimationFrame(passo);
      };

      frameRef.current = requestAnimationFrame(passo);
    });

    if (execucaoRef.current !== minhaExecucao) return;
    setFase("enviando");
    setMensagemColeta(`Calibrando o aparelho e salvando ${ALVO_AMOSTRAS} amostras da letra ${letra}…`);

    let calibracaoLocalSalva = false;
    try {
      let totalLocal = 0;
      for (const landmarks of amostras) {
        totalLocal = adicionarAmostraCalibracao(letra, landmarks);
      }
      if (totalLocal < MINIMO_POR_LETRA) {
        throw new Error("A mão não gerou pontos suficientes para a calibração local.");
      }
      finalizarCalibracao();
      calibracaoLocalSalva = true;
    } catch (erroCalibracao) {
      console.warn("Não foi possível salvar a calibração local de Libras:", erroCalibracao);
    }

    try {
      const resposta = await enviarAmostrasLetra(
        letra,
        amostras,
        idPersistente(),
        idSessao(letra),
      );
      if (execucaoRef.current !== minhaExecucao) return;
      setDataset(resposta.dataset);
      setAutoTreino(resposta.auto_training);
      const atualizacao = descreverAtualizacaoAutomatica(resposta.auto_training);
      setMensagemColeta(
        calibracaoLocalSalva
          ? `${resposta.accepted} amostras da letra ${letra} foram salvas no aparelho e no servidor. ${atualizacao.detalhe}`
          : `${resposta.accepted} amostras da letra ${letra} foram salvas no servidor. ${atualizacao.detalhe}`,
      );
      avisar(`Letra ${letra} salva. ${atualizacao.titulo}.`, "sucesso");
    } catch (erro) {
      if (execucaoRef.current !== minhaExecucao) return;
      const mensagem = (erro as Error).message;
      setMensagemColeta(
        calibracaoLocalSalva
          ? `Calibração salva neste aparelho, mas o servidor não recebeu as amostras: ${mensagem}`
          : `Não foi possível salvar: ${mensagem}`,
      );
      avisar(mensagem, "erro");
    } finally {
      if (execucaoRef.current === minhaExecucao) setFase("parado");
    }
  }

  const letrasProntas = LETRAS_ESTATICAS.filter(
    (item) => (dataset?.per_letter[item] ?? 0) >= MINIMO_POR_LETRA,
  );
  const ocupada = fase !== "parado";
  const progressoColeta = (coletadas / ALVO_AMOSTRAS) * 100;
  const atualizacaoAutomatica = descreverAtualizacaoAutomatica(autoTreino);

  return (
    <>
      <TopHeader titulo="Treinar Libras" voltarPara="/settings" />

      <main className="container archive-main treino-libras-main">
        <section className="treino-libras-intro">
          <span className="material-symbols-outlined" aria-hidden="true">model_training</span>
          <div>
            <p className="treino-libras-sobretitulo">Aprendizado personalizado</p>
            <h2>Ensine o alfabeto ao INSIGHT</h2>
            <p>
              Mostre uma letra por vez. O app captura somente os 21 pontos da mão — não envia
              sua imagem — e usa as amostras para treinar o reconhecimento.
            </p>
            <p className="treino-libras-repetir">
              Você pode treinar a mesma letra mais de uma vez. Cada rodada calibra este aparelho e
              adiciona 45 novas amostras ao servidor.
            </p>
          </div>
        </section>

        <section className="treino-status-grid" aria-label="Estado do treinamento">
          <article className="treino-status-card">
            <span className="material-symbols-outlined" aria-hidden="true">dataset</span>
            <div>
              <strong>{carregandoStatus ? "—" : dataset?.total_samples ?? 0}</strong>
              <small>Amostras salvas</small>
            </div>
          </article>
          <article className="treino-status-card">
            <span className="material-symbols-outlined" aria-hidden="true">spellcheck</span>
            <div>
              <strong>{carregandoStatus ? "—" : `${letrasProntas.length}/${LETRAS_ESTATICAS.length}`}</strong>
              <small>Letras preparadas</small>
            </div>
          </article>
          <article className={`treino-status-card${modelo?.ready ? " pronto" : ""}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {modelo?.ready ? "verified" : "pending"}
            </span>
            <div>
              <strong>{modelo?.ready ? "Ativo" : "Aguardando"}</strong>
              <small>Modelo neural</small>
            </div>
          </article>
        </section>

        {erroStatus && (
          <p className="treino-aviso erro" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
            {erroStatus}
            <button type="button" onClick={() => void atualizarStatus()}>Tentar novamente</button>
          </p>
        )}

        <div className="treino-libras-layout">
          <section className="treino-camera-card" aria-labelledby="titulo-camera-treino">
            <div className={`treino-camera-visor${lado === "user" ? " espelhado" : ""}`}>
              <video ref={videoRef} autoPlay playsInline muted aria-label="Prévia da câmera" />
              <canvas ref={canvasRef} aria-hidden="true" />
              <div className={`treino-mao-status${maoDetectada ? " detectada" : ""}`}>
                <span aria-hidden="true" />
                {maoDetectada ? "Mão detectada" : "Posicione sua mão"}
              </div>
              {regressiva > 0 && <div className="treino-contagem" aria-live="assertive">{regressiva}</div>}
              {(cameraErro || rastreamentoErro) && (
                <div className="treino-camera-erro" role="alert">
                  <span className="material-symbols-outlined" aria-hidden="true">videocam_off</span>
                  {cameraErro || rastreamentoErro}
                  {rastreamentoErro && !cameraErro && (
                    <button type="button" onClick={tentarRastreamentoNovamente}>
                      Tentar novamente
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="treino-camera-rodape">
              <div>
                <p id="titulo-camera-treino">Câmera de treinamento</p>
                <small>
                  {rastreamentoCarregando
                    ? "Carregando rastreamento dos 21 pontos…"
                    : cameraPronta
                      ? "Mova a mão com suavidade durante a coleta."
                      : "Preparando a câmera…"}
                </small>
              </div>
              <button
                type="button"
                className="treino-camera-trocar"
                onClick={trocarLado}
                disabled={ocupada}
                aria-label="Trocar câmera"
              >
                <span className="material-symbols-outlined" aria-hidden="true">cameraswitch</span>
              </button>
            </div>
          </section>

          <section className="treino-controles-card" aria-labelledby="titulo-coleta">
            <div className="treino-etapa-cabecalho">
              <span>1</span>
              <div>
                <h3 id="titulo-coleta">Colete uma letra</h3>
                <p>Comece por F e H. Letras com movimento (Ç, J e Z) não entram neste treino.</p>
              </div>
            </div>

            <div className="treino-letras" role="list" aria-label="Escolha uma letra estática">
              {LETRAS_ESTATICAS.map((item) => {
                const quantidade = dataset?.per_letter[item] ?? 0;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`${letra === item ? "selecionada" : ""}${quantidade >= MINIMO_POR_LETRA ? " pronta" : ""}`}
                    onClick={() => {
                      setLetra(item);
                      setMensagemColeta(dicaDaLetra(item));
                      setColetadas(0);
                    }}
                    disabled={ocupada}
                    aria-pressed={letra === item}
                    aria-label={`Letra ${item}, ${quantidade} amostras salvas`}
                  >
                    <strong>{item}</strong>
                    <small>{quantidade}</small>
                  </button>
                );
              })}
            </div>

            <div className="treino-dica" aria-live="polite">
              <span className="material-symbols-outlined" aria-hidden="true">sign_language</span>
              <p><strong>Letra {letra}</strong>{mensagemColeta}</p>
            </div>

            <div className="treino-dica">
              <span className="material-symbols-outlined" aria-hidden="true">gesture</span>
              <p>
                <strong>J, Z e Ç usam movimento</strong>
                No J, faça a haste e termine o gancho com o mínimo; no Z, desenhe os três
                traços com o indicador; no Ç, mantenha a forma de C e mova para os dois lados.
              </p>
            </div>

            <div className="treino-progresso-bloco">
              <div>
                <span>Progresso da coleta</span>
                <strong>{coletadas}/{ALVO_AMOSTRAS}</strong>
              </div>
              <progress max={100} value={progressoColeta} aria-label="Progresso da coleta" />
            </div>

            {fase === "enviando" ? (
              <button type="button" className="treino-botao secundario" disabled>
                <span className="material-symbols-outlined" aria-hidden="true">cloud_upload</span>
                Salvando amostras…
              </button>
            ) : ocupada ? (
              <button type="button" className="treino-botao secundario" onClick={() => interromperColeta()}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
                Cancelar coleta
              </button>
            ) : (
              <button
                type="button"
                className="treino-botao primario"
                onClick={() => void iniciarColeta()}
                disabled={Boolean(cameraErro || rastreamentoErro)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">motion_photos_on</span>
                Capturar 45 posições
              </button>
            )}
          </section>
        </div>

        <section className="treino-rede-card" aria-labelledby="titulo-treinar-rede">
          <div className="treino-etapa-cabecalho">
            <span>2</span>
            <div>
              <h3 id="titulo-treinar-rede">Atualização automática</h3>
              <p>
                Não precisa esperar nem apertar outro botão. Cada coleta aceita entra no próximo
                modelo automaticamente.
              </p>
            </div>
          </div>

          <div className="treino-auto-status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">autorenew</span>
            <p>
              <strong>{atualizacaoAutomatica.titulo}</strong>
              {atualizacaoAutomatica.detalhe}
            </p>
          </div>

          {modelo?.ready && (
            <p className="treino-modelo-resumo">
              <span className="material-symbols-outlined" aria-hidden="true">verified</span>
              Modelo ativo para {modelo.classes.length} letra(s): {modelo.classes.join(", ")}.
              {typeof modelo.metrics?.validation_accuracy === "number" &&
                ` Precisão de validação: ${Math.round(modelo.metrics.validation_accuracy * 100)}%.`}
            </p>
          )}

        </section>
      </main>
    </>
  );
}

export default function TreinamentoLibrasPage() {
  return (
    <GuardaSessao>
      <TreinamentoLibrasConteudo />
    </GuardaSessao>
  );
}
