"use client";

import { useEffect, useRef } from "react";
import { formulaParaLatex } from "@/lib/matematica-formatacao";
import { exibirMultiplicacao } from "@/lib/matematica";
import "katex/dist/katex.min.css";

export default function FormulaMatematica({ texto }: { texto: string }) {
  const alvo = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let ativo = true;
    const elemento = alvo.current;
    if (!elemento) return;
    elemento.textContent = exibirMultiplicacao(texto);
    const latex = formulaParaLatex(texto);
    if (latex) void import("katex").then(({ default: katex }) => {
      if (!ativo) return;
      try {
        katex.render(latex, elemento, { displayMode: true, throwOnError: true,
          trust: false, strict: "ignore", maxExpand: 200, maxSize: 12, output: "htmlAndMathml" });
      } catch { elemento.textContent = exibirMultiplicacao(texto); }
    }).catch(() => { /* Texto original continua acessível se o renderizador falhar. */ });
    return () => { ativo = false; };
  }, [texto]);
  return <span className="math-formatted" data-formula={texto} ref={alvo}>{exibirMultiplicacao(texto)}</span>;
}
