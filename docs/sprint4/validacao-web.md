# Validação — Front-End Design + Web Development — Sprint 4

Revisão de 3 de novembro de 2026. Este relatório trata da implementação web; o documento de Software e Total Experience registra uma avaliação anterior e tem escopo próprio.

## Implementado

- Landing Page original de `landing-page-sp3` migrada para React em `/`, com assets locais e conteúdo preservado. Menu móvel, navegação ativa, fluxo e carrossel são controlados pelo hook `useLanding`.
- Câmera movida para `/camera`; links internos e início do PWA atualizados.
- Tailwind 4 efetivamente importado (tema/utilitários, sem Preflight), utilizado na Landing Page, login e saída.
- Login de demonstração, cookie HttpOnly assinado, expiração de oito horas, validação no layout privado e logout. O backend continua com o usuário compartilhado já existente.
- Separação dos layouts públicos e privados para evitar mistura dos estilos da apresentação com o aplicativo.
- Service worker atualizado para não armazenar documentos privados, respostas RSC ou endpoints de sessão.
- README com tecnologias, instalação, execução, backend, IA, credenciais, links e instruções de deploy.
- INTEGRANTES.TXT com os cinco nomes e RMs confirmados pelo usuário; equipe da Landing Page corrigida.
- Empacotamento reproduzível em `npm run package`, excluindo arquivos locais de ambiente e dependências.

## Verificações concluídas

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Aprovado, sem erros ou avisos. |
| `npm run typecheck` | Aprovado. |
| `npm run test:auth` | Assinatura, adulteração, token inválido, expiração e rotação da chave aprovadas. |
| `npm test` | Aprovado, incluindo estudo, perfis, páginas, legendas, Libras, matemática, notificações e mídia simulada. |
| `npm run build` | Aprovado com Webpack, configurado como padrão. |
| `node tests/auth-http.mjs` contra produção local | 13 rotas privadas redirecionam sem sessão; acesso com sessão, páginas públicas, senha inválida, origem inválida, JSON inválido, cookie adulterado e logout verificados. |
| Assets da Landing Page | 17 URLs extraídas da página responderam HTTP 200; referências locais verificadas sem arquivos ausentes. |
| Domínio Vercel informado | https://frontend-next-topaz-mu.vercel.app/ respondeu HTTP 200. A nova versão integrada foi publicada com estado READY. |

Os testes de HTTP utilizam `npm start -- --port 3100` em um terminal e `npm run test:auth:http` em outro. Não fazem mutações na API remota.

## Validação em produção

`TEST_BASE_URL=https://frontend-next-topaz-mu.vercel.app node tests/auth-http.mjs` passou após a publicação: 13 rotas privadas, páginas públicas, credenciais incorretas/corretas, proteção de origem, cookie adulterado, logout e 17 assets. Os testes usam somente a sessão de demonstração do frontend; não alteram conteúdos da API.

## Limites e pendências externas

- **Publicação:** concluída no projeto existente `jovi-insight/frontend-next`, autorizado pelo usuário. Deploy `dpl_7eph48Muyd89yQcSCA5TMAv2RUaA`, estado READY, alias https://frontend-next-topaz-mu.vercel.app/. SESSION_SECRET configurada como segredo de produção. Credenciais de demonstração e endereço da API usam os padrões documentados.
- **Responsividade visual:** breakpoints preservados da Landing Page (1120, 900 e 640 px) e aplicativo; utilitários responsivos no login. Não houve inspeção visual porque não havia navegador conectado nesta sessão. Executar o roteiro de 390 × 844, 768 × 1024 e 1440 × 900 do README antes da entrega.
- **API remota — reteste após recuperação do Supabase informada pela equipe:** `/materias`, `/dashboard/recentes?limit=1`, `/pastas` e `/calendario/eventos` responderam HTTP 200 com JSON válido. O erro HTTP 500 anteriormente observado em `/materias` não se repetiu. A recuperação é compatível com o relato da equipe, mas a causa anterior não foi confirmada por logs. OCR, geração de IA, gravação real e notificações não foram testados neste reteste; dependem também de permissões, dispositivos e serviços.
- **Autenticação:** conta de avaliação compartilhada; proteção de páginas não equivale a isolamento multiusuário dos dados da API existente.
- **Contato da Landing Page:** formulário preservado com `mailto:`, depende de cliente de e-mail configurado; não há servidor de envio de mensagens.

A entrega é conjunta e deve ser feita por um único integrante, incluindo o ZIP, o link Git e o link Vercel. Não há garantia de nota: os itens externos acima precisam ser conferidos antes do envio.

## Acesso e pacote de entrega

O README contém a seção **Abrir o aplicativo sem instalar nada**, com apresentação em https://frontend-next-topaz-mu.vercel.app/#inicio, acesso direto a `/login`, login `professor@insight.com`, senha `Insight@2026` e repositório https://github.com/jovi-insight/frontend-next. O ZIP foi regenerado em `entrega/insight-sprint4.zip`. O teste HTTP de produção foi repetido com sucesso: 13 rotas privadas, páginas públicas, login, logout e 17 assets.

## Correção do pacote completo

O pacote foi refeito para incluir também o código do backend em `backend/`, com modelos, SQL, requirements, testes e exemplos de configuração. `README.md` e `INTEGRANTES.TXT` estão diretamente na raiz do ZIP, junto ao código e às configurações do frontend. `CHECKLIST_ENTREGA.md` relaciona os requisitos aos arquivos; `ARQUIVOS_SHA256.txt` contém o inventário. O empacotador extraiu e comparou todos os arquivos, verificou sintaxe dos arquivos Python e consistência do lockfile. Isso valida a integridade do pacote, não substitui a execução dos serviços externos. Credenciais reais, ambientes virtuais e dependências instaladas foram excluídos.
