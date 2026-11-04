# INSIGHT — Sprint 4 · Front-End Design + Web Development

Evolução da solução **INSIGHT para a JOVI Challenge FIAP 2026**, em uma única aplicação React. A Landing Page da Sprint 03 foi migrada de HTML/CSS/JavaScript para componentes React em `/`, preservando identidade, textos, imagens, vídeo, equipe e seções. Menu, fluxo de aprendizagem e carrossel agora usam estado e hooks React. O aplicativo de captura e estudo fica em `/camera`, com acesso pela página de login.

- **Deploy Vercel:** https://frontend-next-topaz-mu.vercel.app/#inicio
- **Repositório Git:** https://github.com/jovi-insight/frontend-next
- **Backend:** https://github.com/jovi-insight/backend
- **Integrantes:** [INTEGRANTES.TXT](INTEGRANTES.TXT)

A versão integrada foi publicada no projeto existente `frontend-next` da equipe `jovi-insight`. Consulte os resultados e limites da validação em `docs/sprint4/validacao-web.md`.

## Abrir o aplicativo sem instalar nada

1. Abra a apresentação: https://frontend-next-topaz-mu.vercel.app/#inicio
2. Clique em **Acessar aplicativo**, ou abra diretamente https://frontend-next-topaz-mu.vercel.app/login.
3. Entre com **Login:** `professor@insight.com` e **Senha:** `Insight@2026`.
4. Você será direcionado para `/camera`. Autorize a câmera/microfone quando precisar desses recursos e use a navegação inferior para acessar calendário, recentes, pastas e ajustes.
5. Use **Sair** para encerrar a sessão.

Para avaliar a versão publicada, basta um navegador e conexão à internet: não é necessário instalar o projeto nem o PWA. As instruções de instalação abaixo existem para permitir que o professor também execute o código em outra máquina, conforme exigido pelo enunciado.

O arquivo para envio está em **`entrega/insight-sprint4.zip`**. O link do repositório é https://github.com/jovi-insight/frontend-next.

## Tecnologias e organização

- React 19, Next.js 16 (App Router) e TypeScript.
- Tailwind CSS 4 via PostCSS: utilitários usados no login, saída e Landing Page. Importamos tema e utilitários sem Preflight para preservar o CSS da Sprint 03.
- CSS responsivo com Grid, Flexbox e media queries; layouts públicos e privados independentes preservam os estilos de cada experiência.
- API própria FastAPI, PostgreSQL/Supabase e serviços de IA; consumo via `fetch` em `lib/api.ts` e módulos especializados.
- IndexedDB para vídeos e LocalStorage para preferências; PWA e notificações, conforme suporte do navegador.
- Componentes com props: `TopHeader`, `Quiz`, `TrilhaEstudo`, entre outros.
- Hooks nativos: `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo` e `useSyncExternalStore`.
- Hooks customizados: `useLanding`, `useLogin`, `useCamera`, `useAula`, `useGravador`, `useNarracao` e `useLocalStorage`, separando comportamento da renderização.

## Instalação em outra máquina

Requer **Node.js 22.13 ou superior**, npm e acesso à internet. Python 3 é necessário somente para recriar o ZIP. Não é necessário instalar o backend para usar a API remota já configurada.

```bash
git clone https://github.com/jovi-insight/frontend-next.git
cd frontend-next
npm ci
npm run setup
npm run dev
```

Se recebeu o ZIP, extraia-o em uma pasta de sua escolha e abra um terminal na pasta onde estão `README.md` e `package.json`, então execute `npm ci`, `npm run setup` e `npm run dev`. Acesse **http://localhost:3000**. `npm run setup` cria `.env.local` com uma chave de sessão aleatória e não sobrescreve configuração existente.

Câmera e microfone exigem permissão e contexto seguro: `localhost` ou HTTPS. Acessar um IP da rede por HTTP pode impedir a captura. OCR, resumo, quiz, tradução e sincronização dependem da disponibilidade e das cotas do backend.

### Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Endereço da API. Padrão: `https://backend-rhlz.onrender.com`. Alterações exigem novo build. |
| `SESSION_SECRET` | Obrigatória, pelo menos 32 caracteres aleatórios; somente servidor. Gerada por `npm run setup`. |
| `DEMO_EMAIL` | Usuário de demonstração; padrão `professor@insight.com`. |
| `DEMO_PASSWORD` | Senha de demonstração; padrão `Insight@2026`. |

O arquivo `.env.example` documenta as variáveis. Não publique `.env.local` nem as credenciais dos serviços externos.

## Login e rotas

**Credenciais de avaliação:**

- E-mail: `professor@insight.com`
- Senha: `Insight@2026`

Acesse `/login`, entre e use o botão **Sair** para encerrar a sessão. A sessão dura oito horas e é assinada no servidor, armazenada em cookie HttpOnly, SameSite=Lax e Secure em HTTPS. Senhas incorretas são rejeitadas. Sem sessão válida, as páginas privadas redirecionam para `/login`.

- Públicas: `/` (Landing Page) e `/login`.
- Privadas: `/camera`, `/library`, `/folders`, `/organize`, `/calendar`, `/calendar/[id]`, `/calendar/[id]/edit`, `/summary/[id]`, `/focus/[id]`, `/player/[id]`, `/settings`, `/translate` e `/libras-training`.
- `/api/session`: criação e exclusão da sessão, com verificação de origem.

Esta é uma **autenticação acadêmica com uma conta compartilhada**. O backend existente utiliza um usuário mockado (`test_user_123`): a sessão protege as páginas do frontend, mas não implementa isolamento de dados entre pessoas nem autenticação da API remota. Não use dados pessoais nesta demonstração. Não há cadastro nem recuperação de senha.

## Executar os servidores

### Frontend em produção local

```bash
npm run build
npm start
```

O build utiliza Webpack para compatibilidade com ambientes que restringem processos auxiliares do Turbopack. Depois acesse http://localhost:3000.

### Backend local (opcional)

O código completo do backend está incluído na pasta `backend/` do ZIP. Para executá-lo, instale Python 3.12+, PostgreSQL e configure Supabase Storage e as chaves de IA, conforme `backend/README.md`. Partindo da pasta extraída:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Se estiver usando somente o checkout Git do frontend, obtenha primeiro o backend com `git clone https://github.com/jovi-insight/backend.git backend`. No ZIP isso não é necessário.

No Windows, ative com `.venv\Scripts\activate` e copie o arquivo com `copy .env.example .env`. Edite o `.env` do backend preenchendo `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_BUCKET` e `GROQ_API_KEY`; configure `ELEVENLABS_API_KEY` se usar narração. Serviços opcionais, modelos de IA e notificações têm variáveis adicionais documentadas no backend.

```bash
uvicorn app.main:app --reload --port 8000
```

Mantenha esse terminal aberto. No `.env.local` do frontend, defina `NEXT_PUBLIC_API_URL=http://localhost:8000`; em outro terminal, execute `npm run dev`. Para um build de produção, refaça o build após mudar essa variável. Sem as contas/chaves de serviços externos, as funcionalidades dependentes deles não funcionarão.

## Onde e como foi utilizada IA

No produto, IA é consumida por meio da API própria para reconhecimento de texto em imagens, geração de resumos e quizzes, tradução, sugestões de organização e trilhas de estudo. As respostas são exibidas para revisão pelo estudante e dependem do serviço remoto. Na evolução desta Sprint, o Codex foi utilizado como apoio à auditoria dos requisitos, migração da Landing Page para React, implementação do fluxo de login, configuração do Tailwind, documentação e execução/ajuste de testes. A equipe deve revisar o resultado antes da entrega. O recurso de Libras é soletração do alfabeto manual; não representa tradução completa de frases sinalizadas.

## Verificações e roteiro de avaliação

```bash
npm run lint
npm run typecheck
npm run test:auth
npm test
npm run build
```

`npm test` inclui os testes de lógica de estudo, perfis, páginas de aula, legendas, Libras, matemática, notificações e gravação/envio com APIs simuladas. Os scripts `test:*:camera`, `test:*:ia` e outros `*.smoke.cjs` legados dependem de navegador/serviço e não fazem parte da validação automatizada padrão.

Roteiro manual em **390 × 844**, **768 × 1024** e **1440 × 900**:

1. Abrir `/`; conferir seções, imagens, vídeo, menu, carrossel e ausência de rolagem horizontal.
2. Abrir `/library` sem login: deve redirecionar para `/login`.
3. Tentar senha incorreta; depois entrar com as credenciais acima.
4. Conferir câmera, biblioteca, pastas, calendário e ajustes; testar permissões negadas e concedidas.
5. Capturar um material de teste, revisar OCR e solicitar resumo/quiz, se a API estiver disponível.
6. Sair e tentar abrir uma rota privada novamente: deve solicitar login.
7. Navegar com teclado, conferir foco e menus, e testar os perfis de acessibilidade.

Os resultados efetivamente obtidos estão em [docs/sprint4/validacao-web.md](docs/sprint4/validacao-web.md).

## Git + Vercel

Importe/conecte o repositório `jovi-insight/frontend-next` ao projeto **frontend-next**, com preset Next.js e raiz do projeto nesta pasta. Cadastre as quatro variáveis descritas acima no ambiente de produção. Gere uma chave exclusiva para `SESSION_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use `npm ci` para instalação e `npm run build` para compilação. Depois do push para a branch de produção conectada, aguarde o deploy e confira a Landing Page e o login no endereço informado. Se publicar via CLI, autentique com `npx vercel login`, vincule ao projeto existente com `npx vercel link` e execute `npx vercel --prod`. Não crie outro projeto para substituir o endereço de entrega.

## ZIP da entrega conjunta

```bash
npm run package
```

Gera **`entrega/insight-sprint4.zip`**, um único pacote para as duas disciplinas, com **README.md e INTEGRANTES.TXT diretamente na raiz do ZIP**. Inclui o código completo do frontend React, a Landing Page integrada, assets, configurações, lockfile e o backend em `backend/`, com requisitos Python, modelos, SQL e `.env.example`.

Inclui também `CHECKLIST_ENTREGA.md`, relacionando os requisitos aos arquivos, e `ARQUIVOS_SHA256.txt`, com o inventário do pacote. O empacotador extrai o arquivo temporariamente e compara cada arquivo antes de salvar o ZIP final.

Para recriar o pacote a partir deste repositório, o backend deve estar em `../backend`, em `./backend` ou na pasta indicada por `INSIGHT_BACKEND_DIR`. No pacote extraído, `backend/` já está presente. Dependências instaladas (`node_modules`, `venv`), builds, histórico Git e segredos locais não são distribuídos; as dependências são reinstaladas pelos comandos documentados. O uso de serviços externos com configuração própria continua exigindo suas próprias contas e chaves. Para avaliar pelo deploy, nenhuma instalação é necessária.

Apenas **um aluno** deve entregar o ZIP e informar os links do Git e da Vercel. Antes do envio, confirme que o deploy contém a mesma versão do código e execute o roteiro de avaliação.
