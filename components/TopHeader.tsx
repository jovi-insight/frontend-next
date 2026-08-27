import Link from "next/link";

/**
 * Cabeçalho fixo de 64px. O jovi.css posiciona pela classe .top-header.
 *
 * O ícone é uma seta de voltar, como no HTML: em /organize, /player e /focus
 * ela é a única saída da tela — não há barra inferior lá. O destino vem por
 * prop porque "voltar" depende da tela, não do histórico (chegar no resumo
 * pela câmera e voltar cairia na tela de organizar, já consumida).
 */
export default function TopHeader({
  titulo = "INSIGHT",
  voltarPara = "/library",
}: {
  titulo?: string;
  voltarPara?: string;
}) {
  return (
    <header className="top-header">
      <div className="flex items-center gap-4">
        <Link
          href={voltarPara}
          className="text-primary alvo-toque"
          style={{ textDecoration: "none" }}
          aria-label="Voltar"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {titulo}
        </h1>
      </div>
    </header>
  );
}
