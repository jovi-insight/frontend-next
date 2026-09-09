"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useMatematica } from "@/lib/use-matematica";
import { lerFormula } from "@/lib/matematica-api";
import type { OperacaoMatematica } from "@/lib/matematica-avancada";
import type { SolucaoMatematica } from "@/lib/matematica";
import "./matematica-camera.css";

export default function MatematicaCamera({ videoRef, pronta, zoom, pausaExterna, pulso }: {
  videoRef: RefObject<HTMLVideoElement | null>; pronta: boolean; zoom: number; pausaExterna: boolean; pulso: number;
}) {
  const molduraRef = useRef<HTMLDivElement | null>(null);
  const resultadoRef = useRef<HTMLDivElement | null>(null);
  const [pausada, setPausada] = useState(false);
  const [editando, setEditando] = useState(false);
  const [expressao, setExpressao] = useState("");
  const [operacao, setOperacao] = useState<OperacaoMatematica>("auto");
  const [variavel, setVariavel] = useState("x");
  const [inferior, setInferior] = useState("0");
  const [superior, setSuperior] = useState("1");
  const [manual, setManual] = useState<SolucaoMatematica | null>(null);
  const [fixa, setFixa] = useState<SolucaoMatematica | null>(null);
  const [erro, setErro] = useState("");
  const [avisoIA, setAvisoIA] = useState("");
  const [lendoIA, setLendoIA] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [mostrarPassos, setMostrarPassos] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const montado = useRef(true);
  const requisicao = useRef<AbortController | null>(null);
  const versaoManual = useRef(0);
  const opcoes = { operacao, variavel, inferior, superior };
  const leitura = useMatematica(videoRef, molduraRef, pronta, zoom,
    pausada || editando || lendoIA || pausaExterna, opcoes);
  const solucao = editando ? manual : pausada ? fixa : leitura.solucao;
  const ultimoPulso = useRef(pulso);
  // O disparador continua útil: congela/descongela a leitura, sem tirar foto desnecessária.
  useEffect(() => {
    if (ultimoPulso.current === pulso) return;
    ultimoPulso.current = pulso;
    setFixa(leitura.solucao);
    setPausada((antes) => !antes);
  }, [pulso, leitura.solucao]);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; requisicao.current?.abort(); versaoManual.current++; };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (manual) resultadoRef.current?.scrollIntoView({ block: "nearest" });
  }, [manual]);

  function editar() {
    setExpressao(solucao?.expressao ?? expressao); setEditando(true); setManual(null); setErro("");
  }
  function limparResultado() { versaoManual.current++; setManual(null); setErro(""); }
  async function calcular() {
    const versao = ++versaoManual.current;
    setCalculando(true); setErro(""); setManual(null);
    try {
      const resposta = await leitura.calcular({ ...opcoes, expressao });
      if (versao !== versaoManual.current) return;
      if (resposta.ok) setManual(resposta.solucao);
      else setErro(resposta.motivo);
    } catch { if (versao === versaoManual.current) setErro("Não foi possível iniciar o motor matemático."); }
    finally { if (montado.current) setCalculando(false); }
  }
  async function lerComIA() {
    requisicao.current?.abort();
    const controller = new AbortController(); requisicao.current = controller;
    setLendoIA(true); setErro(""); setManual(null); setEditando(true); setAvisoIA("");
    versaoManual.current++;
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const foto = await leitura.capturarFormula();
      if (controller.signal.aborted || !montado.current) return;
      if (!foto) throw new Error("Aguarde a câmera ficar pronta.");
      setPreview(URL.createObjectURL(foto));
      const resposta = await lerFormula(foto, controller.signal);
      if (controller.signal.aborted) return;
      setExpressao(resposta.expressao); setOperacao(resposta.operacao); setVariavel(resposta.variavel);
      if (resposta.inferior != null) setInferior(resposta.inferior);
      if (resposta.superior != null) setSuperior(resposta.superior);
      setAvisoIA(`Leitura da IA (${resposta.confianca}). Confira símbolos, operação e limites antes de calcular. ${resposta.observacao || ""}`);
    } catch (e) {
      if (montado.current && requisicao.current === controller) setErro(controller.signal.aborted ? "A leitura foi cancelada ou demorou demais. Você pode digitar a fórmula." : (e as Error).message);
    } finally { clearTimeout(timeout); if (montado.current && requisicao.current === controller) setLendoIA(false); }
  }
  function voltar() {
    requisicao.current?.abort(); requisicao.current = null;
    versaoManual.current++; setLendoIA(false); setCalculando(false); setEditando(false);
    setPausada(false); setFixa(null); setManual(null); setPreview(null); setAvisoIA(""); setErro(""); setMostrarPassos(false);
  }

  return (
    <section className="math-live" aria-label="Matemática na câmera" onPointerDown={(e) => e.stopPropagation()}>
      <div className={`math-frame${solucao ? " math-frame-found" : ""}`} ref={molduraRef} aria-hidden="true">
        <span>{editando ? "Revisão da fórmula" : "Enquadre a expressão inteira"}</span>
      </div>
      <div className="math-card">
        <div className="math-heading">
          <span className="math-badge"><span className="material-symbols-outlined" aria-hidden="true">bolt</span> Matemática</span>
          <span className="math-location">{lendoIA ? "Leitura online" : editando ? "Cálculo local" : pausada ? "Pausado" : "Ao vivo · no aparelho"}</span>
        </div>
        <div className="math-options">
          <label>Operação<select aria-label="Operação matemática" value={operacao} onChange={(e) => { setOperacao(e.target.value as OperacaoMatematica); limparResultado(); setFixa(null); }}>
            <option value="auto">Automática</option><option value="derivar">Derivada</option>
            <option value="integrar">Integral</option><option value="definida">Integral definida</option><option value="resolver">Resolver equação</option>
          </select></label>
          <label>Variável<input aria-label="Variável de cálculo" maxLength={1} value={variavel} onChange={(e) => { setVariavel(e.target.value); limparResultado(); setFixa(null); }} /></label>
        </div>
        {operacao === "definida" && <div className="math-options">
          <label>De<input aria-label="Limite inferior" value={inferior} onChange={(e) => { setInferior(e.target.value); limparResultado(); setFixa(null); }} /></label>
          <label>Até<input aria-label="Limite superior" value={superior} onChange={(e) => { setSuperior(e.target.value); limparResultado(); setFixa(null); }} /></label>
        </div>}
        {editando ? <form onSubmit={(e) => { e.preventDefault(); void calcular(); }}>
          {preview && <img className="math-preview" src={preview} alt="Recorte da fórmula enviado para reconhecimento" /> /* eslint-disable-line @next/next/no-img-element */}
          <label className="math-input-label">Expressão
            <input autoFocus className="math-expression-input" aria-label="Expressão matemática" maxLength={240} autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder="x^3 + sin(x)" value={expressao} onChange={(e) => { setExpressao(e.target.value); limparResultado(); }} />
          </label>
          {avisoIA && <p className="math-note">{avisoIA}</p>}
          <div className="math-actions"><button className="math-primary" type="submit" disabled={lendoIA || calculando || !expressao.trim()}>{calculando ? "Calculando…" : "Conferir e calcular"}</button>
            <button type="button" onClick={voltar}>Voltar ao vivo</button></div>
        </form> : <>
          {!solucao && <p className="math-status" role="status">{pausada ? "Leitura pausada." : leitura.mensagem}</p>}
          {leitura.estado === "preparando" && <><progress aria-label="Preparação do leitor" max={100} value={leitura.progresso} /><p className="math-note">Primeiro uso: carregando o modelo. Depois a leitura roda aqui, sem enviar a imagem.</p></>}
        </>}
        {lendoIA && <p role="status" className="math-status">Lendo a notação com IA… pode levar alguns segundos.</p>}
        {erro && <p role="alert" className="math-error">{erro}</p>}
        {solucao && <div className="math-answer" ref={resultadoRef} aria-live="polite">
          <span className="math-read-label">Expressão lida</span><code className="math-read">{solucao.expressao}</code>
          <output aria-label="Resultado matemático">{solucao.resultado}</output>
          {solucao.aviso && <p className="math-note">{solucao.aviso}</p>}
          {!editando && !pausada && leitura.tempoMs != null && <small>Leitura + cálculo: {(leitura.tempoMs / 1000).toFixed(2)} s nesta execução</small>}
          {pausada && <small>Resultado fixado — não acompanha mudanças na câmera.</small>}
          <button type="button" className="math-explain" aria-expanded={mostrarPassos} onClick={() => {
            if (!editando && !pausada) { setFixa(solucao); setPausada(true); }
            setMostrarPassos(!mostrarPassos);
          }}>{mostrarPassos ? "Ocultar explicação" : "Entender o resultado"}</button>
          {mostrarPassos && <div className="math-explanation"><ol>{solucao.passos.map((p, i) => <li key={i}>{p}</li>)}</ol></div>}
        </div>}
        {!editando && <div className="math-actions">
          <button type="button" onClick={editar}>{solucao ? "Corrigir leitura" : "Digitar fórmula"}</button>
          <button type="button" onClick={() => { setFixa(solucao); setPausada(!pausada); }}>{pausada ? "Retomar" : "Pausar"}</button>
          {leitura.estado === "erro" && <button type="button" onClick={leitura.tentarNovamente}>Tentar novamente</button>}
        </div>}
        <button className="math-cloud" type="button" disabled={!pronta || lendoIA} onClick={() => void lerComIA()}>
          <span className="material-symbols-outlined" aria-hidden="true">document_scanner</span> Ler fórmula com IA
        </button>
        <p className="math-note">Ao vivo: expressão impressa em uma linha. Frações empilhadas, integrais e manuscritos: use a leitura com IA (envia apenas o recorte) e revise. Cálculos avançados podem levar mais tempo.</p>
      </div>
    </section>
  );
}
