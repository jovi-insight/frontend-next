import type { Metadata } from "next";
import "../tailwind.css";
import "./landing.css";
export const metadata: Metadata = { title: "INSIGHT — da aula para o aprendizado", description: "Capture, organize e revise o conteúdo da aula em uma experiência acessível. Evolução da JOVI Challenge FIAP 2026." };
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
