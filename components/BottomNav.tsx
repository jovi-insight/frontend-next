"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// No vanilla cada página marcava o item ativo à mão. Aqui o pathname resolve
// isso sozinho — é o único motivo de o componente ser client.
const ITENS = [
  { href: "/", icone: "photo_camera", rotulo: "Câmera" },
  { href: "/calendar", icone: "calendar_month", rotulo: "Calendário" },
  { href: "/library", icone: "history", rotulo: "Recentes" },
  { href: "/folders", icone: "folder_open", rotulo: "Pastas" },
  { href: "/settings", icone: "settings", rotulo: "Ajustes" },
];

export default function BottomNav() {
  const atual = usePathname();

  return (
    <nav className="bottom-nav">
      {ITENS.map(({ href, icone, rotulo }) => {
        const ativo = href === "/" ? atual === "/" : atual.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${ativo ? " active" : ""}`}
            aria-current={ativo ? "page" : undefined}
          >
            <span className="material-symbols-outlined">{icone}</span>
            <span>{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
