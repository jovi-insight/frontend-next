import type { Metadata, Viewport } from "next";
import "./globals.css";
import AplicaPerfil from "@/components/AplicaPerfil";
import Avisos from "@/components/Avisos";

export const metadata: Metadata = {
  title: "JOVI | Insight Capture System",
  description:
    "Captura e organização de anotações com OCR, resumo por IA e recursos de acessibilidade.",
};

// viewport-fit=cover: a .bottom-nav do jovi.css usa env(safe-area-inset-bottom)
// para não ficar embaixo do indicador de gesto do iPhone e do Android.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Material Symbols é fonte de ícones variável e não passa pelo
            next/font; a Inter já vem no @import do jovi.css.
            display=block e não optional: com a fonte ausente o navegador
            mostraria o nome do ícone como texto ("volume_up" escrito na tela)
            em vez de nada. eslint-disable porque a regra assume next/font. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
      </head>
      <body>
        {/* O perfil precisa valer em toda página, não só na tela de Ajustes. */}
        <AplicaPerfil />
        {children}
        <Avisos />
      </body>
    </html>
  );
}
