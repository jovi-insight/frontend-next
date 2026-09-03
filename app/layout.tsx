import type { Metadata, Viewport } from "next";
import "./globals.css";
import AplicaPerfil from "@/components/AplicaPerfil";
import Avisos from "@/components/Avisos";
import PwaRegister from "@/components/PwaRegister";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import LembretesCalendario from "@/components/LembretesCalendario";

export const metadata: Metadata = {
  title: "INSIGHT | Capture, estude e evolua",
  description:
    "Captura e organização de anotações com OCR, resumo por IA e recursos de acessibilidade.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "INSIGHT",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
};

// viewport-fit=cover: a .bottom-nav do jovi.css usa env(safe-area-inset-bottom)
// para não ficar embaixo do indicador de gesto do iPhone e do Android.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121212",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="INSIGHT" />
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
        <PwaRegister />
        <PwaInstallPrompt />
        <LembretesCalendario />
        {/* O perfil precisa valer em toda página, não só na tela de Ajustes. */}
        <AplicaPerfil />
        {children}
        <Avisos />
      </body>
    </html>
  );
}
