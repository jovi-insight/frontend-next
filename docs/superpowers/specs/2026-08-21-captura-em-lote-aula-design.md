# Captura em lote: uma aula, um documento

**Data:** 2026-08-21
**Estado:** aguardando revisão

## O problema

Um estudante em tempo integral assiste cinco ou seis aulas por dia, e o
professor enche e apaga o quadro várias vezes na mesma aula. Hoje o JOVI trata
cada foto como um documento independente:

```
hoje:  4 fotos → 4 documentos → 4 resumos → 4 quizzes
       4 × (capturar · organizar · escolher matéria · confirmar · esperar ~25s)
```

Nenhum desses quatro resumos vê a aula inteira: cada um resume um terço de
quadro, sem contexto do que veio antes. O quiz cobre um pedaço. E a fricção de
repetir o fluxo inteiro por foto faz o aluno desistir e voltar a fotografar
pela galeria do celular.

## O que muda

```
proposta:  5 fotos → 1 aula → 1 resumo da aula · 1 quiz da aula
           capturar × 5 (sem sair da câmera) · concluir · organizar uma vez
```

## Por que o resumo e o quiz melhoram sozinhos

`POST /ia/resumo` e `POST /ia/quiz` leem o **mesmo campo**:

- `app/routers/ia.py:157` → `gemini_service.gerar_resumo(conteudo.extracao_original)`
- `app/routers/ia.py:239` → `gemini_service.gerar_quiz(conteudo.extracao_original, num)`

Basta o texto das cinco páginas entrar em `extracao_original` para os dois
passarem a enxergar a aula inteira. **Nenhuma das duas rotas é alterada.**

## Modelo de dados

Nenhuma migração. O banco já é 1-para-N:

- `models/conteudo.py:28` → `imagens = relationship("Imagem", ...)`
- `models/imagens.py` → `id_conteudo = ForeignKey("conteudos.id")`

Uma aula é **um `Conteudo` com N `Imagem`**. O `ConteudoOut` já devolve
`imagens[]` como lista; o frontend só mostra a primeira porque hoje nunca chega
mais de uma.

Decisão registrada: **não** criar entidade `Aula`. Uma tabela nova exigiria
migração e mexeria em resumo, quiz, biblioteca e lixeira — tudo o que já
funciona sobre `Conteudo`.

## Por que as fotos ficam no aparelho

O cache de imagens do backend é **em memória, com TTL de 300s**
(`app/core/cache.py:19`). Duas consequências:

1. Numa aula de 50 minutos, o `cache_id` da primeira foto expira muito antes do
   fim. Mandar uma lista de `cache_id` no final falharia com 410 em quase toda
   aula real.
2. Aumentar o TTL não resolve: o cache vive na memória do processo. Trinta
   alunos com fotos de 3 MB passam de 1 GB, contra os 512 MB do plano free do
   Render — e um restart por ociosidade levaria tudo.

Por isso as imagens **ficam no aparelho** até o aluno tocar em Concluir. A aula
pode durar duas horas, ele pode fechar o app no intervalo: nada expira.

O texto, esse sim, é extraído durante a aula — cada foto vai para
`/ia/analisar-imagem` assim que é tirada, então no fim não há espera acumulada.

## Fluxo na câmera

No modo **SCAN**, o disparo passa a acumular páginas em vez de sair da tela:

- tira de miniaturas embaixo, na ordem da captura
- contador de páginas no shutter
- ✕ em cada miniatura para descartar a que saiu tremida
- ✓ na miniatura quando a OCR daquela página voltou
- botão **Concluir (N)** leva para a tela de organizar, uma vez só

Custo aceito: uma foto avulsa passa a exigir dois toques (capturar → concluir)
em vez de um. Em troca, não existe modo escondido que o aluno precise descobrir.

## Backend

Rota **nova**: `POST /conteudo/aula`, multipart.

| campo | tipo |
|---|---|
| `imagens` | N arquivos |
| `id_materia` | uuid |
| `texto_extraido` | texto das páginas concatenado (ver formato abaixo) |

Devolve o mesmo `ConteudoOut`.

Formato do texto concatenado — o separador existe para o Gemini não colar o fim
de um quadro no começo do outro, e para a origem de cada trecho continuar
legível no resumo:

```
[Página 1]
<texto da primeira foto>

[Página 2]
<texto da segunda foto>
```

Página cuja OCR falhou entra como `[Página N] (não foi possível ler)`, para o
aluno saber que aquele quadro ficou de fora.

Nova em vez de alterada porque `/conteudo/confirmar` continua servindo o app
vanilla, que também está em produção. Nada quebra lá.

## Apresentação

Conteúdo com mais de uma imagem aparece como **"Aula — N páginas"**, com a tira
de miniaturas no lugar da foto única, no resumo e na galeria por matéria.

## Erros

| situação | comportamento |
|---|---|
| OCR de uma página falha | a página entra sem texto, marcada na tira; não bloqueia as outras nem o envio |
| upload final falha | as fotos continuam no aparelho e o botão volta — nada se perde por rede ruim |
| aluno sai da câmera com páginas pendentes | confirmação antes de descartar |

## Testes

- **Acumulador de páginas** (adicionar, remover, ordem, contagem, estado da
  OCR): lógica pura, sem DOM — teste em Node, como o processador de blocos da
  transcrição.
- **Rota nova**: ida e volta com duas imagens, verificando que o `ConteudoOut`
  devolve duas entradas em `imagens[]` e o texto concatenado em
  `extracao_original`.
- **Navegador (CDP)**: capturar três páginas, descartar uma, concluir, e
  conferir que o resumo gerado cobre o texto das duas restantes.

## Ordem de entrega

1. **PR no backend** (`POST /conteudo/aula`) — primeiro, porque depende de
   merge e redeploy.
2. **Frontend** — enquanto o PR não entra, o lote salva o texto das N páginas
   com a última foto pelo `/conteudo/confirmar` atual. A tela do aluno não muda
   quando o backend chegar; só passam a aparecer as N imagens.

## Fora de escopo

- Entidade `Aula` no banco.
- Reordenar páginas depois de capturadas.
- Sincronizar as fotos entre aparelhos.
- Detecção automática de borda ou correção de perspectiva.
