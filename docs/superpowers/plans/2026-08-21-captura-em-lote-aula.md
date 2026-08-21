# Captura em lote (uma aula, um documento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fotografar várias páginas do quadro sem sair da câmera e salvá-las como uma única aula, cujo resumo e quiz cobrem todo o conteúdo.

**Architecture:** As fotos ficam no aparelho até o envio (o cache do backend expira em 300s e vive em memória). Uma rota nova recebe as N imagens em multipart e cria **um** `Conteudo` com **N** `Imagem` — o banco já é 1-para-N. Como `/ia/resumo` e `/ia/quiz` leem `conteudo.extracao_original`, basta o texto das páginas chegar concatenado nesse campo para os dois passarem a enxergar a aula inteira, sem alteração.

**Tech Stack:** Backend FastAPI + SQLAlchemy (Python 3.11). Frontend Next.js 16.3.1 (App Router, React 19, TypeScript). Testes de lógica pura em Node com `assert`, compilando o TS com `npx tsc`.

**Spec:** `frontend-next/docs/superpowers/specs/2026-08-21-captura-em-lote-aula-design.md`

## Global Constraints

- **Duas raízes de repositório diferentes.** Backend em `/home/Guimen/Documentos/Github/JOVI/backend`, frontend em `/home/Guimen/Documentos/Github/JOVI/frontend-next`. São repos git separados: cada um tem seu próprio commit e seu próprio PR.
- **Backend: PR contra `dev`**, seguindo o padrão do time (`feat/*` → `dev` → `main`). Nunca commitar direto em `main`.
- **Frontend: PR contra `main`** — o `dev` do frontend está 49 commits atrás e é abandonado.
- **`/conteudo/confirmar` não pode ser alterado.** O app vanilla também está em produção e depende dele. A rota de aula é nova.
- **Nenhuma migração de banco.** `Conteudo.imagens` já é 1-para-N (`app/models/conteudo.py:28`).
- **O backend não tem suíte de testes** (`find . -name "test_*.py"` volta vazio; `pytest` não está no `requirements.txt`). Montar uma do zero — pytest, conftest, banco de teste, mocks de Supabase e Gemini — é um projeto à parte e não entra aqui. As tarefas de backend usam **critério de aceite verificável por `curl`** contra o servidor; as de frontend usam TDD de verdade, que é onde já existe padrão de teste.
- **Texto das páginas concatenado** exatamente neste formato, com linha em branco entre páginas:
  ```
  [Página 1]
  <texto>

  [Página 2]
  <texto>
  ```
  Página cuja OCR falhou entra como `[Página N] (não foi possível ler)`.
- **Comentários e mensagens de commit em português**, seguindo o restante dos dois repos.
- **Nada de `innerHTML`** com texto vindo da IA; sempre `textContent` / JSX.

---

### Task 1: O service aceita várias imagens

**Files:**
- Modify: `backend/app/services/conteudo_service.py:26-86`
- Modify: `backend/app/routers/conteudo.py:96-104` (único chamador)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `criar_conteudo_com_imagem(db, user_id, id_materia, texto_extraido, urls_imagens: list[str], videos=None) -> Conteudo` — a Task 2 chama com uma lista de N urls.

- [ ] **Step 1: Confirmar que só existe um chamador**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
grep -rn "criar_conteudo_com_imagem" --include="*.py" . | grep -v __pycache__
```
Expected: exatamente duas linhas — a definição em `app/services/conteudo_service.py:26` e a chamada em `app/routers/conteudo.py:96`. Se aparecer um terceiro chamador, pare e ajuste o plano: a mudança de assinatura abaixo o quebraria.

- [ ] **Step 2: Trocar o parâmetro singular pelo plural**

Em `backend/app/services/conteudo_service.py`, na assinatura (linha ~31), troque:

```python
    url_imagem: str,
```

por:

```python
    urls_imagens: list[str],
```

E no corpo, troque o bloco que cria uma imagem:

```python
    # [MANIPULAÇÃO DE VARIÁVEIS] Vincula a imagem ao conteúdo
    imagem = Imagem(id_conteudo=conteudo.id, url_storage=url_imagem)
    db.add(imagem)
```

por:

```python
    # [LISTA + REPETIÇÃO] Vincula as imagens ao conteúdo, na ordem em que
    # foram capturadas — uma aula tem várias páginas do quadro.
    for url in urls_imagens:
        db.add(Imagem(id_conteudo=conteudo.id, url_storage=url))
```

Ajuste também a docstring: `"Cria pasta (se não existir), conteúdo e vincula as imagens."`

- [ ] **Step 3: Atualizar o chamador existente**

Em `backend/app/routers/conteudo.py`, na chamada da linha ~96, troque o argumento:

```python
        url_imagem=url_imagem,
```

por:

```python
        urls_imagens=[url_imagem],
```

(O nome da variável local `url_imagem` continua o mesmo; só o argumento passa a ser uma lista de um elemento.)

- [ ] **Step 4: Verificar que o módulo ainda compila**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
python3 -m compileall -q app/services/conteudo_service.py app/routers/conteudo.py && echo "compila ok"
```
Expected: `compila ok`, sem nenhuma linha de erro antes.

- [ ] **Step 5: Verificar que nenhum `url_imagem=` sobrou**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
grep -rn "url_imagem=" --include="*.py" . | grep -v __pycache__
```
Expected: nenhuma saída. Se aparecer alguma linha, é um chamador que ficou com o argumento antigo — corrija antes de seguir.

- [ ] **Step 6: Commit**

```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
git checkout -b feat/conteudo-aula
git add app/services/conteudo_service.py app/routers/conteudo.py
git commit -m "refactor(conteudo): service aceita varias imagens por conteudo

Prepara a captura em lote: uma aula e um Conteudo com N Imagem. O banco ja
era 1-para-N, so o service assumia uma imagem so. O unico chamador
(/conteudo/confirmar) passa a mandar uma lista de um elemento, sem mudanca
de comportamento.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Rota `POST /conteudo/aula`

**Files:**
- Modify: `backend/app/routers/conteudo.py` (adicionar rota ao fim do arquivo)

**Interfaces:**
- Consumes: `criar_conteudo_com_imagem(..., urls_imagens=[...])` da Task 1.
- Produces: `POST /conteudo/aula` — multipart com os campos `imagens` (N arquivos), `id_materia` (uuid, form field) e `texto_extraido` (string, form field). Responde `ConteudoOut`. A Task 5 do frontend consome esta rota.

- [ ] **Step 1: Adicionar a rota**

No fim de `backend/app/routers/conteudo.py`, acrescente:

```python
@router.post("/aula", response_model=ConteudoOut)
async def criar_aula(
    imagens: list[UploadFile] = File(...),
    id_materia: UUID = Form(...),
    texto_extraido: str = Form(...),
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cria uma aula: um conteúdo com VÁRIAS páginas do quadro.

    Diferente de /conteudo/confirmar, as imagens chegam direto no corpo em vez
    de virem do cache — uma aula dura mais que os 300s de TTL do cache
    (app/core/cache.py:19), então guardá-las no servidor durante a aula não
    funcionaria.
    """
    if not imagens:
        raise HTTPException(status_code=400, detail="Envie ao menos uma imagem.")

    materia = db.query(Materia).filter(Materia.id == id_materia).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    # Upload de cada página, na ordem em que foram capturadas.
    urls: list[str] = []
    for imagem in imagens:
        conteudo_bytes = await imagem.read()
        try:
            url = await storage_service.upload_image(
                file_bytes=conteudo_bytes,
                content_type=imagem.content_type or "image/jpeg",
                nome_materia=materia.nome,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erro no upload Supabase: {e}")
        urls.append(url)

    # Vídeos são best-effort: a aula é salva mesmo se a IA não responder.
    try:
        videos = await gemini_service.recomendar_videos(texto_extraido, materia.nome)
    except Exception:
        videos = []

    conteudo = conteudo_service.criar_conteudo_com_imagem(
        db=db,
        user_id=user_id,
        id_materia=id_materia,
        texto_extraido=texto_extraido,
        urls_imagens=urls,
        videos=videos,
    )
    return conteudo
```

- [ ] **Step 2: Garantir os imports que a rota usa**

No topo de `backend/app/routers/conteudo.py`, confirme que `File`, `Form` e `UploadFile` vêm do FastAPI e que `UUID` vem de `uuid`. Rode:

```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
head -20 app/routers/conteudo.py
```

Se `File`, `Form` ou `UploadFile` não estiverem na linha `from fastapi import ...`, acrescente-os a essa linha. Se `UUID` não estiver importado, acrescente `from uuid import UUID`.

- [ ] **Step 3: Verificar que compila**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
python3 -m compileall -q app/routers/conteudo.py && echo "compila ok"
```
Expected: `compila ok`.

- [ ] **Step 4: Commit**

```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
git add app/routers/conteudo.py
git commit -m "feat(conteudo): rota POST /conteudo/aula com varias paginas

Recebe N imagens em multipart e cria um unico Conteudo com N Imagem. As
imagens vem no corpo, e nao do cache, porque uma aula dura mais que os 300s
de TTL dele.

/conteudo/confirmar fica intacto: o app vanilla, tambem em producao, depende
dele.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Abrir o PR**

```bash
cd /home/Guimen/Documentos/Github/JOVI/backend
git push -u origin feat/conteudo-aula
gh pr create --base dev --head feat/conteudo-aula \
  --title "feat(conteudo): rota POST /conteudo/aula (captura em lote)" \
  --body "Cria um Conteudo com N Imagem a partir de N fotos em multipart, para a captura em lote do app: uma aula vira um documento, e /ia/resumo e /ia/quiz passam a cobrir a aula inteira sem alteracao (as duas leem conteudo.extracao_original).

Sem migracao: Conteudo.imagens ja e 1-para-N.
/conteudo/confirmar intacto — o app vanilla depende dele.

Design: frontend-next/docs/superpowers/specs/2026-08-21-captura-em-lote-aula-design.md"
```

- [ ] **Step 6: Critério de aceite após o merge e o redeploy**

Depois que o PR entrar em `dev`, `dev` for para `main` e o Render redeployar, rode:

```bash
MATERIA=$(curl -s https://backend-rhlz.onrender.com/materias | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
python3 -c "
import base64,pathlib
# dois JPEGs mínimos e válidos, só para o upload ter o que subir
jpeg = base64.b64decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==')
for n in ('p1.jpg','p2.jpg'): pathlib.Path('/tmp/'+n).write_bytes(jpeg)
"
curl -s -X POST https://backend-rhlz.onrender.com/conteudo/aula \
  -F "imagens=@/tmp/p1.jpg;type=image/jpeg" \
  -F "imagens=@/tmp/p2.jpg;type=image/jpeg" \
  -F "id_materia=$MATERIA" \
  -F "texto_extraido=[Página 1]
primeira pagina da aula

[Página 2]
segunda pagina da aula" \
| python3 -c "
import json,sys
d=json.load(sys.stdin)
print('imagens salvas:', len(d.get('imagens',[])))
print('texto guardado:', repr(d.get('extracao_original','')[:60]))
assert len(d.get('imagens',[])) == 2, 'deveria ter 2 imagens'
print('OK')
"
```
Expected: `imagens salvas: 2` e `OK`. Se vier 1, a Task 1 não foi aplicada corretamente.

**Atenção:** isso grava um documento de verdade no banco de produção. Avise antes de rodar, e remova depois se quiser (não há DELETE de conteúdo — só some da galeria pela lixeira local do app).

---

### Task 3: Acumulador de páginas (lógica pura)

**Files:**
- Create: `frontend-next/lib/paginas-aula.ts`
- Test: `frontend-next/tests/paginas-aula.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Pagina = { id: string; imagem: string; miniatura: string; texto: string | null; estado: "lendo" | "pronta" | "falhou" }`
  - `criarPagina(imagem: string, miniatura: string): Pagina`
  - `marcarTexto(paginas: Pagina[], id: string, texto: string): Pagina[]`
  - `marcarFalha(paginas: Pagina[], id: string): Pagina[]`
  - `removerPagina(paginas: Pagina[], id: string): Pagina[]`
  - `textoDaAula(paginas: Pagina[]): string`
  - `janelaDeAula: { blobs: Blob[] }` — repositório em memória das fotos entre a câmera e a tela de organizar
  - As Tasks 4 e 5 consomem todas estas.

- [ ] **Step 1: Escrever o teste que falha**

Crie `frontend-next/tests/paginas-aula.test.mjs`:

```javascript
import assert from "node:assert";
import {
  criarPagina, marcarTexto, marcarFalha, removerPagina, textoDaAula,
} from "../.teste-build/paginas-aula.js";

// Uma página nasce "lendo": a OCR só volta depois.
{
  const p = criarPagina("data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BB");
  assert.strictEqual(p.estado, "lendo");
  assert.strictEqual(p.texto, null);
  assert.ok(p.id, "precisa de id para casar a resposta da OCR com a página");
}

// Dois disparos seguidos não podem gerar o mesmo id, senão a OCR de uma
// sobrescreveria o texto da outra.
{
  const a = criarPagina("x", "y");
  const b = criarPagina("x", "y");
  assert.notStrictEqual(a.id, b.id);
}

// A ordem de captura é a ordem do texto — mesmo se a OCR voltar fora de ordem.
{
  let ps = [criarPagina("i1", "m1"), criarPagina("i2", "m2"), criarPagina("i3", "m3")];
  ps = marcarTexto(ps, ps[2].id, "terceira");
  ps = marcarTexto(ps, ps[0].id, "primeira");
  ps = marcarTexto(ps, ps[1].id, "segunda");
  assert.strictEqual(
    textoDaAula(ps),
    "[Página 1]\nprimeira\n\n[Página 2]\nsegunda\n\n[Página 3]\nterceira",
  );
}

// Página que a OCR não leu entra marcada, em vez de sumir sem aviso.
{
  let ps = [criarPagina("i1", "m1"), criarPagina("i2", "m2")];
  ps = marcarTexto(ps, ps[0].id, "deu certo");
  ps = marcarFalha(ps, ps[1].id);
  assert.strictEqual(ps[1].estado, "falhou");
  assert.strictEqual(
    textoDaAula(ps),
    "[Página 1]\ndeu certo\n\n[Página 2] (não foi possível ler)",
  );
}

// Descartar a foto tremida renumera as seguintes.
{
  let ps = [criarPagina("i1", "m1"), criarPagina("i2", "m2"), criarPagina("i3", "m3")];
  ps = marcarTexto(ps, ps[0].id, "a");
  ps = marcarTexto(ps, ps[1].id, "tremida");
  ps = marcarTexto(ps, ps[2].id, "c");
  ps = removerPagina(ps, ps[1].id);
  assert.strictEqual(ps.length, 2);
  assert.strictEqual(textoDaAula(ps), "[Página 1]\na\n\n[Página 2]\nc");
}

// Resposta atrasada de uma página já removida não pode ressuscitá-la.
{
  let ps = [criarPagina("i1", "m1")];
  const idRemovido = ps[0].id;
  ps = removerPagina(ps, idRemovido);
  ps = marcarTexto(ps, idRemovido, "chegou tarde");
  assert.strictEqual(ps.length, 0);
}

// Sem página nenhuma, o texto é vazio (o botão de concluir fica desabilitado).
{
  assert.strictEqual(textoDaAula([]), "");
}

// As funções não mutam o array recebido — o React precisa de referência nova.
{
  const original = [criarPagina("i1", "m1")];
  const depois = marcarTexto(original, original[0].id, "x");
  assert.notStrictEqual(original, depois);
  assert.strictEqual(original[0].texto, null, "o array original foi mutado");
}

console.log("paginas-aula.test.mjs OK");
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
npx tsc lib/paginas-aula.ts --outDir .teste-build --module es2022 --target es2022 --moduleResolution bundler 2>&1 | head -3
node tests/paginas-aula.test.mjs
```
Expected: FALHA. Primeiro o `tsc` reclama que `lib/paginas-aula.ts` não existe; depois o node falha ao importar `../.teste-build/paginas-aula.js`.

- [ ] **Step 3: Escrever a implementação mínima**

Crie `frontend-next/lib/paginas-aula.ts`:

```typescript
/**
 * Páginas de uma aula em captura.
 *
 * Funções puras, sem DOM: recebem a lista e devolvem outra. A imagem em si
 * fica aqui (data URL) até o aluno concluir — o cache do backend expira em
 * 300s e uma aula dura bem mais.
 */

export type EstadoPagina = "lendo" | "pronta" | "falhou";

export type Pagina = {
  id: string;
  /** Data URL da foto em resolução cheia, o que sobe no fim. */
  imagem: string;
  /** Data URL reduzida, para a tira de miniaturas. */
  miniatura: string;
  texto: string | null;
  estado: EstadoPagina;
};

export function criarPagina(imagem: string, miniatura: string): Pagina {
  return {
    // A OCR volta assíncrona e fora de ordem; o id é o que liga a resposta
    // à página certa.
    id: `pag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imagem,
    miniatura,
    texto: null,
    estado: "lendo",
  };
}

export function marcarTexto(paginas: Pagina[], id: string, texto: string): Pagina[] {
  return paginas.map((p) =>
    p.id === id ? { ...p, texto: texto.trim(), estado: "pronta" as const } : p,
  );
}

export function marcarFalha(paginas: Pagina[], id: string): Pagina[] {
  return paginas.map((p) => (p.id === id ? { ...p, estado: "falhou" as const } : p));
}

export function removerPagina(paginas: Pagina[], id: string): Pagina[] {
  return paginas.filter((p) => p.id !== id);
}

/**
 * Texto da aula inteira, na ordem de captura.
 *
 * O separador existe para o Gemini não colar o fim de um quadro no começo do
 * outro — e é o que faz /ia/resumo e /ia/quiz cobrirem a aula toda.
 */
/**
 * As imagens da aula não cabem no localStorage (data URLs de fotos estouram a
 * cota de ~5 MB). Ficam aqui entre a câmera e a tela de organizar, que são a
 * mesma sessão de navegação — é memória, não persistência.
 */
export const janelaDeAula: { blobs: Blob[] } = { blobs: [] };

export function textoDaAula(paginas: Pagina[]): string {
  return paginas
    .map((p, i) => {
      const cabecalho = `[Página ${i + 1}]`;
      if (p.estado === "falhou" || !p.texto) return `${cabecalho} (não foi possível ler)`;
      return `${cabecalho}\n${p.texto}`;
    })
    .join("\n\n");
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
npx tsc lib/paginas-aula.ts --outDir .teste-build --module es2022 --target es2022 --moduleResolution bundler
node tests/paginas-aula.test.mjs
```
Expected: `paginas-aula.test.mjs OK`.

Nota: o teste da página vazia espera `""` — `[].map(...).join()` devolve string vazia, então isso já sai de graça.

- [ ] **Step 5: Impedir que a pasta de build entre no git**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
grep -q "^.teste-build" .gitignore || echo ".teste-build/" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
git checkout -b feat/captura-em-lote
git add lib/paginas-aula.ts tests/paginas-aula.test.mjs .gitignore
git commit -m "feat(aula): acumulador de paginas da captura em lote

Funcoes puras que guardam as fotos da aula, casam a resposta assincrona da
OCR com a pagina certa pelo id, e concatenam o texto na ordem de captura com
separador de pagina.

Pagina que a OCR nao leu entra marcada em vez de sumir; resposta atrasada de
pagina ja descartada e ignorada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Cliente da rota de aula

**Files:**
- Modify: `frontend-next/lib/api.ts` (acrescentar ao fim da seção "Conteúdo")

**Interfaces:**
- Consumes: `Conteudo` (tipo já existente em `lib/api.ts`).
- Produces: `criarAula(imagens: Blob[], materiaId: string, textoExtraido: string): Promise<Conteudo>` — a Task 5 consome.

- [ ] **Step 1: Acrescentar a função**

Em `frontend-next/lib/api.ts`, logo depois de `confirmarConteudo`, acrescente:

```typescript
/**
 * Salva uma aula: várias páginas do quadro em um único conteúdo.
 *
 * As imagens vão no corpo, e não pelo cache do backend, porque o cache expira
 * em 300s e uma aula dura bem mais. Resumo e quiz saem da aula inteira porque
 * o texto concatenado vira o `extracao_original` do conteúdo.
 */
export async function criarAula(
  imagens: Blob[],
  materiaId: string,
  textoExtraido: string,
): Promise<Conteudo> {
  const form = new FormData();
  imagens.forEach((imagem, i) => form.append("imagens", imagem, `pagina-${i + 1}.jpg`));
  form.append("id_materia", materiaId);
  form.append("texto_extraido", textoExtraido);

  const res = await fetch(`${BASE_URL}/conteudo/aula`, { method: "POST", body: form });
  return handle(res, "Falha ao salvar a aula");
}
```

- [ ] **Step 2: Verificar tipos**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
npx tsc --noEmit 2>&1 | head -5
```
Expected: nenhuma saída.

- [ ] **Step 3: Commit**

```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
git add lib/api.ts
git commit -m "feat(api): cliente de POST /conteudo/aula

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Tira de páginas na câmera

**Files:**
- Modify: `frontend-next/app/page.tsx`
- Modify: `frontend-next/app/globals.css` (acrescentar ao fim)

**Interfaces:**
- Consumes: `criarPagina`, `marcarTexto`, `marcarFalha`, `removerPagina`, `textoDaAula` (Task 3); `criarAula` (Task 4); `analisarImagem` e `avisar` (já existentes).
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Importar o que a tela vai usar**

Em `frontend-next/app/page.tsx`, junto dos outros imports:

```typescript
import {
  criarPagina, marcarTexto, marcarFalha, removerPagina, textoDaAula, type Pagina,
} from "@/lib/paginas-aula";
```

E acrescente `criarAula` ao import que já existe de `@/lib/api`:

```typescript
import { analisarImagem, criarAula } from "@/lib/api";
```

- [ ] **Step 2: Guardar as páginas no estado**

Dentro de `CameraConteudo`, junto dos outros `useState`:

```typescript
  // Páginas da aula em captura. Ficam no aparelho até o aluno concluir.
  const [paginas, setPaginas] = useState<Pagina[]>([]);
```

- [ ] **Step 3: O disparo do SCAN passa a acumular**

Em `disparar`, substitua o bloco que hoje começa em `setOcupado("Enviando para o servidor…")` e termina no `finally` por:

```typescript
    // SCAN acumula páginas: a foto entra na tira e a OCR corre em segundo
    // plano, para o aluno continuar fotografando o quadro seguinte.
    const pagina = criarPagina(imagem, miniatura ?? imagem);
    setPaginas((antes) => [...antes, pagina]);

    try {
      const resultado = await analisarImagem(await (await fetch(imagem)).blob());
      setPaginas((antes) => marcarTexto(antes, pagina.id, resultado.texto_extraido || ""));
    } catch (e) {
      console.warn("OCR da página falhou:", e);
      setPaginas((antes) => marcarFalha(antes, pagina.id));
    }
```

- [ ] **Step 4: Concluir a aula**

Acrescente, junto das outras funções de `CameraConteudo`:

```typescript
  /** Envia as páginas como uma aula e segue para organizar. */
  async function concluirAula() {
    if (!paginas.length) return;
    if (paginas.some((p) => p.estado === "lendo")) {
      avisar("Ainda estou lendo uma das páginas. Um instante.", "info");
      return;
    }

    setOcupado(`Salvando ${paginas.length} páginas…`);
    try {
      // As imagens são data URLs; o backend recebe binário.
      const blobs = await Promise.all(
        paginas.map(async (p) => (await fetch(p.imagem)).blob()),
      );
      gravarLocalStorage(
        "aula_pendente",
        JSON.stringify({ texto: textoDaAula(paginas), paginas: blobs.length }),
      );
      // A escolha da matéria continua na tela de organizar; guardamos as
      // imagens aqui até lá.
      janelaDeAula.blobs = blobs;
      router.push("/organize?aula=1");
    } catch (e) {
      // Falhou o envio: as páginas continuam na tira, nada se perde.
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(null);
    }
  }
```

O `janelaDeAula` usado acima vem de `lib/paginas-aula.ts` (Task 3, Step 3-b) — importe-o junto das outras funções:

```typescript
import { janelaDeAula } from "@/lib/paginas-aula";
```

- [ ] **Step 5: Desenhar a tira**

No JSX, logo antes de `<div className="camera-mode-selector">`, acrescente:

```tsx
      {modo === "SCAN" && paginas.length > 0 && (
        <div className="tira-paginas">
          <div className="tira-lista">
            {paginas.map((p, i) => (
              <div key={p.id} className={`tira-item estado-${p.estado}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.miniatura} alt={`Página ${i + 1}`} />
                <span className="tira-numero">{i + 1}</span>
                {p.estado === "lendo" && <span className="tira-spinner" aria-hidden="true" />}
                {p.estado === "falhou" && (
                  <span className="material-symbols-outlined tira-alerta" title="Não foi possível ler">
                    error
                  </span>
                )}
                <button
                  type="button"
                  className="tira-remover"
                  onClick={() => setPaginas((antes) => removerPagina(antes, p.id))}
                  aria-label={`Descartar página ${i + 1}`}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="tira-concluir" onClick={concluirAula}>
            Concluir ({paginas.length})
          </button>
        </div>
      )}
```

- [ ] **Step 5-b: Avisar antes de perder as páginas**

A spec pede confirmação antes de descartar páginas pendentes. Como o aluno pode
trocar de modo ou fechar a aba, cubra os dois casos.

Ainda em `CameraConteudo`, acrescente o efeito que segura o fechamento da aba:

```typescript
  // Fechar a aba com páginas capturadas perderia a aula inteira: as fotos só
  // vivem em memória até o envio.
  useEffect(() => {
    if (paginas.length === 0) return;
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [paginas.length]);
```

E, no `onClick` dos botões de modo, troque `setModo(m)` por uma versão que
pergunta antes:

```tsx
            onClick={() => {
              if (
                paginas.length > 0 &&
                m !== modo &&
                !confirm(`Descartar as ${paginas.length} páginas capturadas?`)
              ) {
                return;
              }
              if (m !== modo) setPaginas([]);
              setModo(m);
              setGaveta(null);
            }}
```

- [ ] **Step 6: Estilos da tira**

No fim de `frontend-next/app/globals.css`:

```css

/* ─── Tira de páginas da aula (modo SCAN) ──────────────────
   Fica acima do seletor de modo, para não cobrir o shutter. */
.tira-paginas {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 244px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tira-lista {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
  padding: 4px;
  scrollbar-width: none;
}

.tira-lista::-webkit-scrollbar { display: none; }

.tira-item {
  position: relative;
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.tira-item img { width: 100%; height: 100%; object-fit: cover; }
.tira-item.estado-lendo img { opacity: 0.5; }
.tira-item.estado-falhou { border-color: #d05353; }
.tira-item.estado-pronta { border-color: #57c98a; }

.tira-numero {
  position: absolute;
  left: 3px;
  bottom: 2px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.tira-spinner {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.tira-alerta {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 20px;
  height: 20px;
  font-size: 20px;
  color: #e88a8a;
}

/* 44px seria maior que a própria miniatura; 24px com o toque folgado ao redor
   é o compromisso possível aqui. */
.tira-remover {
  position: absolute;
  top: 0;
  right: 0;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  touch-action: manipulation;
}

.tira-remover .material-symbols-outlined { font-size: 15px; }

.tira-concluir {
  flex: 0 0 auto;
  min-height: 48px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  touch-action: manipulation;
}

@media (prefers-reduced-motion: reduce) {
  .tira-spinner { animation: none; }
}
```

- [ ] **Step 7: Verificar build e lint**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
npx tsc --noEmit 2>&1 | head -5
npx eslint . 2>&1 | grep -E "error|problems"
npx next build 2>&1 | grep -E "Compiled|Failed"
```
Expected: `tsc` sem saída; eslint com `0 errors` (o aviso do `display=block` na fonte é conhecido e permanece); build `✓ Compiled successfully`.

- [ ] **Step 8: Verificar no navegador**

Com o servidor de dev rodando em `localhost:3000` e o Chrome de CDP na porta 9225 (ver `/tmp/jovi-cdp/cdp.mjs`), rode:

```bash
timeout 150 node /tmp/jovi-cdp/cdp.mjs "http://localhost:3000/" 8 "
(async () => {
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const q = s => document.querySelector(s);
  q('.shutter-button').click(); await esperar(2500);
  q('.shutter-button').click(); await esperar(2500);
  const log = [];
  log.push('miniaturas na tira: ' + document.querySelectorAll('.tira-item').length);
  log.push('botao: ' + (q('.tira-concluir') ? q('.tira-concluir').textContent.trim() : 'FALTOU'));
  document.querySelectorAll('.tira-remover')[0].click(); await esperar(400);
  log.push('apos descartar: ' + document.querySelectorAll('.tira-item').length);
  return log.join('\n');
})()
"
```
Expected: `miniaturas na tira: 2`, `botao: Concluir (2)`, `apos descartar: 1`.

- [ ] **Step 9: Commit**

```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
git add app/page.tsx app/globals.css
git commit -m "feat(camera): captura em lote no modo SCAN

O disparo acumula paginas em vez de sair da tela: tira de miniaturas com o
numero da pagina, estado da OCR e botao de descartar a foto tremida. A OCR
corre em segundo plano para o aluno continuar fotografando.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Organizar e salvar a aula

**Files:**
- Modify: `frontend-next/app/organize/page.tsx`

**Interfaces:**
- Consumes: `janelaDeAula` (Task 3), `criarAula` (Task 4), `textoDaAula` já aplicado ao texto guardado em `aula_pendente`.
- Produces: nada.

- [ ] **Step 1: Ler o modo aula**

Em `frontend-next/app/organize/page.tsx`, junto dos outros imports:

```typescript
import { useSearchParams } from "next/navigation";
import { criarAula } from "@/lib/api";
import { janelaDeAula } from "@/lib/paginas-aula";
```

E dentro de `OrganizeConteudo`:

```typescript
  const ehAula = useSearchParams().get("aula") === "1";
  const aulaBruta = useLocalStorage("aula_pendente");
  const aula = useMemo(() => {
    try {
      return aulaBruta ? (JSON.parse(aulaBruta) as { texto: string; paginas: number }) : null;
    } catch {
      return null;
    }
  }, [aulaBruta]);
```

- [ ] **Step 2: Confirmar pela rota de aula quando for aula**

Dentro de `confirmar`, antes da chamada existente a `confirmarConteudo`, acrescente:

```typescript
    if (ehAula && aula) {
      const conteudo = await criarAula(janelaDeAula.blobs, escolhida, texto);
      const materia = materias.find((m) => m.id === escolhida);
      gravarLocalStorage(
        "jovi_last_scan_result",
        JSON.stringify({ ...conteudo, materia_nome: materia?.nome ?? null }),
      );
      janelaDeAula.blobs = [];
      avisar(`Aula salva com ${aula.paginas} páginas.`, "sucesso");
      router.push(`/summary/${conteudo.id}`);
      return;
    }
```

- [ ] **Step 3: Preencher o texto com o da aula**

No bloco de inicialização que hoje faz `setTexto(textoInicial)`, troque a origem do texto:

```typescript
    setTexto(ehAula && aula ? aula.texto : textoInicial);
```

E ajuste o rótulo do campo, logo acima do `<textarea>`:

```tsx
        <label className="form-label" htmlFor="texto-ocr">
          {ehAula && aula
            ? `Texto de ${aula.paginas} páginas — corrija se precisar`
            : "Texto reconhecido — corrija se precisar"}
        </label>
```

- [ ] **Step 4: Deixar a tela abrir no modo aula**

O guarda no topo do componente hoje devolve o estado vazio quando `!scan`. Troque a condição para aceitar também a aula:

```typescript
  if (!scan && !(ehAula && aula)) {
```

- [ ] **Step 5: Verificar build e lint**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
npx tsc --noEmit 2>&1 | head -5
npx eslint . 2>&1 | grep -E "error|problems"
npx next build 2>&1 | grep -E "Compiled|Failed"
```
Expected: `tsc` sem saída; `0 errors`; `✓ Compiled successfully`.

- [ ] **Step 6: Verificar o fluxo inteiro no navegador**

```bash
timeout 200 node /tmp/jovi-cdp/cdp.mjs "http://localhost:3000/" 8 "
(async () => {
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const q = s => document.querySelector(s);
  q('.shutter-button').click(); await esperar(3000);
  q('.shutter-button').click(); await esperar(3000);
  q('.tira-concluir').click(); await esperar(4000);
  return 'rota: ' + location.pathname + location.search
    + ' | rotulo: ' + (q('label[for=texto-ocr]') ? q('label[for=texto-ocr]').textContent : '-')
    + ' | texto tem separador: ' + (q('textarea') ? q('textarea').value.includes('[Página 2]') : false);
})()
"
```
Expected: rota `/organize?aula=1`, rótulo mencionando 2 páginas, e `texto tem separador: true`.

- [ ] **Step 7: Commit e PR**

```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
git add app/organize/page.tsx
git commit -m "feat(organize): salvar a aula com varias paginas

Quando vem da captura em lote, a confirmacao usa POST /conteudo/aula e manda
as N imagens; o texto ja chega concatenado com separador de pagina, entao o
resumo e o quiz cobrem a aula inteira.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git push -u origin feat/captura-em-lote
gh pr create --base main --head feat/captura-em-lote \
  --title "feat: captura em lote — uma aula, um documento" \
  --body "Fotografar varias paginas do quadro sem sair da camera e salvar como uma aula so.

- modo SCAN acumula paginas, com tira de miniaturas, estado da OCR e descarte
- as fotos ficam no aparelho ate concluir (o cache do backend expira em 300s)
- o texto vai concatenado com separador de pagina, entao /ia/resumo e /ia/quiz
  passam a cobrir a aula inteira sem alteracao nas rotas

Depende de jovi-insight/backend (POST /conteudo/aula) para salvar as N imagens.

Design: docs/superpowers/specs/2026-08-21-captura-em-lote-aula-design.md
Plano: docs/superpowers/plans/2026-08-21-captura-em-lote-aula.md"
```

---

### Task 7: Mostrar a aula como várias páginas

**Files:**
- Modify: `frontend-next/app/summary/[id]/page.tsx`
- Modify: `frontend-next/app/library/page.tsx` (componente `Miniatura`)
- Modify: `frontend-next/app/globals.css` (acrescentar ao fim)

**Interfaces:**
- Consumes: `Conteudo.imagens` (já existente).
- Produces: nada.

- [ ] **Step 1: Trocar a imagem única pela tira**

Em `frontend-next/app/summary/[id]/page.tsx`, substitua o bloco que renderiza `doc.imagens?.[0]` por:

```tsx
            {doc.imagens?.length > 0 && (
              <section>
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">
                    {doc.imagens.length > 1 ? `Aula — ${doc.imagens.length} páginas` : "Original"}
                  </h3>
                </div>
                <div className={doc.imagens.length > 1 ? "paginas-aula" : undefined}>
                  {doc.imagens.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.url_storage}
                      alt={
                        doc.imagens.length > 1
                          ? `Página ${i + 1} da aula`
                          : "Imagem original do documento"
                      }
                      className="doc-original-image"
                      loading="lazy"
                    />
                  ))}
                </div>
              </section>
            )}
```

- [ ] **Step 2: Estilo da tira de páginas no resumo**

No fim de `frontend-next/app/globals.css`:

```css

/* Páginas de uma aula, no resumo: rolam na horizontal para não empurrar o
   quiz para fora da tela no celular. */
.paginas-aula {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x mandatory;
}

.paginas-aula .doc-original-image {
  flex: 0 0 auto;
  width: 78%;
  scroll-snap-align: start;
}

@media (min-width: 600px) {
  .paginas-aula .doc-original-image { width: 240px; }
}
```

- [ ] **Step 3: Verificar build e lint**

Run:
```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
npx tsc --noEmit 2>&1 | head -5
npx eslint . 2>&1 | grep -E "error|problems"
npx next build 2>&1 | grep -E "Compiled|Failed"
```
Expected: `tsc` sem saída; `0 errors`; `✓ Compiled successfully`.

- [ ] **Step 4: Verificar com um documento de uma página só**

Abra um documento antigo (uma imagem) e confirme que o título continua "Original" e a imagem ocupa a largura normal, sem virar tira:

```bash
timeout 120 node /tmp/jovi-cdp/cdp.mjs "http://localhost:3000/summary/8c090469-940f-4e9b-a032-89e4c4697f8c" 9 "
JSON.stringify({
  titulo: [...document.querySelectorAll('.secao-titulo')].map(h => h.textContent),
  viroutira: !!document.querySelector('.paginas-aula'),
  imagens: document.querySelectorAll('.doc-original-image').length,
}, null, 1)
"
```
Expected: um dos títulos é `Original`, `viroutira: false`, `imagens: 1`.

- [ ] **Step 4-b: Marcar a aula também na galeria por matéria**

A spec pede a marcação "no resumo **e na galeria por matéria**". Em
`frontend-next/app/library/page.tsx`, dentro do componente `Miniatura`, logo
depois do `<span className="selo-data">`, acrescente:

```tsx
      {doc.imagens?.length > 1 && (
        <span className="selo-paginas" title={`Aula com ${doc.imagens.length} páginas`}>
          {doc.imagens.length}
          <span className="material-symbols-outlined">filter_none</span>
        </span>
      )}
```

E no fim de `frontend-next/app/globals.css`:

```css

/* Miniatura de aula: o número de páginas no canto, como a pilha de fotos da
   galeria do celular. */
.selo-paginas {
  position: absolute;
  right: 4px;
  bottom: 3px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.selo-paginas .material-symbols-outlined { font-size: 12px; }
```

Verifique que um documento de uma imagem só não ganha o selo:

```bash
timeout 120 node /tmp/jovi-cdp/cdp.mjs "http://localhost:3000/library" 9 "
JSON.stringify({
  miniaturas: document.querySelectorAll('.album-item').length,
  selosDePaginas: document.querySelectorAll('.selo-paginas').length,
}, null, 1)
"
```
Expected: `selosDePaginas: 0` enquanto não houver aula salva; depois de salvar uma
aula de 2 páginas, `1`.

- [ ] **Step 5: Commit**

```bash
cd /home/Guimen/Documentos/Github/JOVI/frontend-next
git add app/summary/\[id\]/page.tsx app/library/page.tsx app/globals.css
git commit -m "feat(summary): aula aparece com todas as paginas

Conteudo com mais de uma imagem vira 'Aula — N paginas', com as paginas em
tira rolavel. Documento de uma imagem so continua igual.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
