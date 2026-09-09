"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { capturarFormula } from "@/lib/matematica-captura";
import { lerFormula, resolverFormula, type ResolucaoIA } from "@/lib/matematica-api";
import { revisarDivisaoImplicita, type RevisaoMatematica } from "@/lib/matematica";
import type { OperacaoMatematica } from "@/lib/matematica-avancada";
import "./matematica-camera.css";

export default function MatematicaCamera({ videoRef, pronta, zoom, pausaExterna, pulso }: {
  videoRef: RefObject<HTMLVideoElement | null>; pronta: boolean; zoom: number; pausaExterna: boolean; pulso: number;
}) {
  const moldura = useRef<HTMLDivElement | null>(null), disparador = useRef<HTMLButtonElement | null>(null);
  const resultadoRef = useRef<HTMLDivElement | null>(null);
  const foto = useRef<Blob | null>(null), requisicao = useRef<AbortController | null>(null);
  const montado = useRef(true), ultimoPulso = useRef(pulso);
  const operacaoEscolhida = useRef<OperacaoMatematica | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [expressao, setExpressao] = useState("");
  const [operacao, setOperacao] = useState<OperacaoMatematica>("auto");
  const [variavel, setVariavel] = useState("x"), [valor, setValor] = useState("");
  const [inferior, setInferior] = useState(""), [superior, setSuperior] = useState("");
  const [atividade, setAtividade] = useState<"leitura" | "resolucao" | null>(null);
  const [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [resolucao, setResolucao] = useState<ResolucaoIA | null>(null);
  const [revisao, setRevisao] = useState<RevisaoMatematica | null>(null);
  const ocupada = atividade !== null;

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; requisicao.current?.abort(); };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (ultimoPulso.current === pulso) return;
    ultimoPulso.current = pulso; disparador.current?.click();
  }, [pulso]);
  useEffect(() => { if (resolucao) resultadoRef.current?.scrollIntoView({ block: "nearest" }); }, [resolucao]);

  function limparResultado() { setResolucao(null); setRevisao(null); setErro(""); }
  function novaFoto() {
    requisicao.current?.abort(); requisicao.current = null;
    foto.current = null; setPreview(null); setEditando(false); setExpressao("");
    setAtividade(null); setAviso(""); limparResultado();
  }
  async function lerFoto(reutilizar = false) {
    requisicao.current?.abort();
    const controller = new AbortController(); requisicao.current = controller;
    setAtividade("leitura"); limparResultado(); setAviso(""); setExpressao("");
    const prazo = setTimeout(() => controller.abort(), 20000);
    try {
      const captura = reutilizar && foto.current ? foto.current : await capturarFormula(videoRef.current, moldura.current, zoom);
      if (controller.signal.aborted || !montado.current) return;
      foto.current = captura; setPreview(URL.createObjectURL(captura)); setEditando(true);
      const leitura = await lerFormula(captura, controller.signal);
      if (controller.signal.aborted || !montado.current) return;
      setExpressao(leitura.expressao);
      if (!operacaoEscolhida.current) {
        setOperacao(leitura.operacao); setVariavel(leitura.variavel);
        setInferior(leitura.inferior ?? ""); setSuperior(leitura.superior ?? "");
      }
      setAviso(`Leitura da IA (${leitura.confianca}). Confira a expressão e o que deseja calcular. ${operacaoEscolhida.current ? "Mantive sua operação. " : ""}${leitura.observacao || ""}`);
      if (!leitura.expressao.trim()) setErro("Não consegui ler a fórmula. Ajuste a foto ou corrija o texto antes de resolver.");
    } catch (e) {
      if (montado.current && requisicao.current === controller) setErro(controller.signal.aborted ? "A leitura demorou demais. Sua foto foi mantida; tente novamente." : (e as Error).message);
    } finally {
      clearTimeout(prazo);
      if (montado.current && requisicao.current === controller) { setAtividade(null); requisicao.current = null; }
    }
  }
  async function resolver() {
    limparResultado();
    const agrupamento = revisarDivisaoImplicita(expressao);
    if (agrupamento) { setRevisao(agrupamento); return; }
    if (!expressao.trim()) { setErro("Confira a expressão antes de resolver."); return; }
    if (operacao === "avaliar" && !valor.trim()) { setErro(`Informe o valor de ${variavel}.`); return; }
    if (operacao === "definida" && (!inferior.trim() || !superior.trim())) { setErro("Informe os dois limites da integral."); return; }
    requisicao.current?.abort();
    const controller = new AbortController(); requisicao.current = controller;
    setAtividade("resolucao");
    const prazo = setTimeout(() => controller.abort(), 45000);
    try {
      const resposta = await resolverFormula({ expressao, operacao, variavel, inferior, superior, valor }, controller.signal);
      if (!controller.signal.aborted && montado.current) setResolucao(resposta);
    } catch (e) {
      if (montado.current && requisicao.current === controller) setErro(controller.signal.aborted ? "A resolução demorou demais. Sua expressão foi mantida; tente novamente." : (e as Error).message);
    } finally {
      clearTimeout(prazo);
      if (montado.current && requisicao.current === controller) { setAtividade(null); requisicao.current = null; }
    }
  }

  return <section className="math-live" aria-label="Matemática por foto com IA" onPointerDown={e => e.stopPropagation()}>
    <div className="math-frame" ref={moldura} aria-hidden={!editando}>
      {editando && preview && <img className="math-frame-photo" src={preview} alt="Foto da expressão enviada para a IA" /> /* eslint-disable-line @next/next/no-img-element */}
      <span>{editando ? "Foto capturada · confira abaixo" : "Enquadre toda a expressão e fotografe"}</span>
    </div>
    <div className="math-card">
      <div className="math-heading"><span className="math-badge">Matemática · IA</span><span className="math-location">Foto → revisão → solução</span></div>
      {!editando && <p className="math-status">Fotografe a conta para a IA reconhecer. Depois, confira a expressão e peça a resolução passo a passo.</p>}
      <button ref={disparador} hidden={editando} className="math-primary math-capture" type="button" disabled={!pronta || pausaExterna || ocupada} onClick={() => void lerFoto()}>Fotografar e ler com IA</button>
      {editando && <>
        <form onSubmit={e => { e.preventDefault(); void resolver(); }}>
          <label className="math-input-label">Confira a expressão
            <input className="math-expression-input" aria-label="Expressão matemática" disabled={ocupada} maxLength={240} autoComplete="off" autoCapitalize="off" spellCheck={false} value={expressao} onChange={e => { setExpressao(e.target.value); limparResultado(); }} />
          </label>
          <div className="math-options">
            <label>O que calcular?<select aria-label="Operação matemática" disabled={ocupada} value={operacao} onChange={e => {
              const op = e.target.value as OperacaoMatematica; operacaoEscolhida.current = op === "auto" ? null : op;
              setOperacao(op); limparResultado();
            }}>
              <option value="auto">Automática · conta ou equação</option><option value="avaliar">Calcular valor de f(x)</option><option value="simplificar">Simplificar</option>
              <option value="derivar">Derivada</option><option value="integrar">Integral</option><option value="definida">Integral definida</option><option value="resolver">Resolver equação</option>
            </select></label>
            <label>Variável<input aria-label="Variável de cálculo" disabled={ocupada} maxLength={1} value={variavel} onChange={e => { setVariavel(e.target.value); limparResultado(); }} /></label>
          </div>
          {operacao === "avaliar" && <label className="math-input-label">Valor de {variavel}<input className="math-expression-input" aria-label="Valor da variável" disabled={ocupada} maxLength={60} value={valor} onChange={e => { setValor(e.target.value); limparResultado(); }} /></label>}
          {operacao === "definida" && <div className="math-options">
            <label>De<input aria-label="Limite inferior" disabled={ocupada} maxLength={60} value={inferior} onChange={e => { setInferior(e.target.value); limparResultado(); }} /></label>
            <label>Até<input aria-label="Limite superior" disabled={ocupada} maxLength={60} value={superior} onChange={e => { setSuperior(e.target.value); limparResultado(); }} /></label>
          </div>}
          {aviso && <p className="math-note">{aviso}</p>}
          <div className="math-actions"><button className="math-primary" type="submit" disabled={ocupada || pausaExterna || !expressao.trim()}>Resolver com IA · passo a passo</button></div>
        </form>
        <div className="math-actions">
          <button type="button" disabled={ocupada} onClick={() => void lerFoto(true)}>Reler esta foto com IA</button>
          <button type="button" onClick={novaFoto}>{ocupada ? "Cancelar e voltar à câmera" : "Nova foto"}</button>
        </div>
      </>}
      {atividade && <p role="status" className="math-status">{atividade === "leitura" ? "A IA está lendo sua foto…" : "A IA está resolvendo e preparando os passos…"}</p>}
      {erro && <p role="alert" className="math-error">{erro}</p>}
      {revisao && <div className="math-review" role="group" aria-label="Confirmar agrupamento">
        <p>Confirme o agrupamento antes de enviar à IA:</p>
        {revisao.alternativas.map(op => <button type="button" key={op.expressao} onClick={() => { setExpressao(op.expressao); limparResultado(); }}>{op.descricao}<code>{op.expressao}</code></button>)}
        {!revisao.alternativas.length && <p>Edite a expressão com * e parênteses explícitos.</p>}
      </div>}
      {resolucao && <div className="math-answer" ref={resultadoRef} aria-live="polite">
        {resolucao.status === "resolvido" ? <>
          <span className="math-read-label">Expressão confirmada</span><code className="math-read">{expressao}</code>
          <span className="math-read-label">Resultado da IA</span><output aria-label="Resultado matemático">{resolucao.resultado}</output>
          <h3>Passo a passo</h3><ol className="math-steps" aria-label="Passo a passo da resolução">{resolucao.passos.map((passo, i) => <li key={i}>
            <h4>{passo.titulo}</h4><p>{passo.explicacao}</p>{passo.formula && <code>{passo.formula}</code>}
          </li>)}</ol>
          <p className="math-note">Resolução gerada por IA. Confira os passos e a expressão da foto.</p>
        </> : <p className="math-status" role="status">{resolucao.pergunta}</p>}
        {resolucao.aviso && <p className="math-note">{resolucao.aviso}</p>}
      </div>}
      <p className="math-note">Sem detecção ao vivo. A foto só é enviada ao fotografar ou reler; a resolução só é solicitada após sua confirmação. Requer internet.</p>
    </div>
  </section>;
}
