import Link from "next/link";

/** Cabeçalho fixo de 64px. O jovi.css posiciona pela classe .top-header. */
export default function TopHeader({ titulo = "JOVI" }: { titulo?: string }) {
  return (
    <header className="top-header">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-primary alvo-toque"
          style={{ textDecoration: "none" }}
          aria-label="Início"
        >
          <span className="material-symbols-outlined">menu</span>
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
