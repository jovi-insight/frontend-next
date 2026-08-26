# JOVI Frontend (Next.js)

Interface web moderna do **JOVI** (Insight Capture System), construída com Next.js 16 (App Router), React 19 e TypeScript.

## 🚀 Funcionalidades

- **Captura e OCR**: Escaneamento inteligente de documentos físicos com OCR e sugestão automática de matérias.
- **Captura em Lote (Modo Aula)**: Registro contínuo de aulas com múltiplas páginas e transcrição por voz.
- **Resumos com IA**: Geração de resumos automáticos estruturados a partir do conteúdo escaneado.
- **Galeria de Vídeos & Mídia**: Armazenamento local de vídeos de aula com miniaturas automáticas, reprodução com sincronização de legendas/transcrição e transcrição segmentada.
- **Acessibilidade e Personalização**: Modos dedicados para baixa visão, dislexia, TDAH, daltonismo e suporte a tradução/narração em áudio.
- **Organização Inteligente**: Estrutura em matérias, pastas e documentos com lixeira e restauração.

## 🛠️ Tecnologias

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: CSS Modular & Design System JOVI
- **Armazenamento Local**: IndexedDB (vídeos) & LocalStorage (preferências e cache)

## 📦 Como Rodar Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Abra [http://localhost:3000](http://localhost:3000) no navegador.

## 🏗️ Build de Produção

```bash
npm run build
npm start
```
