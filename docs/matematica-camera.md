# Matemática na câmera

Acesso: câmera → SCAN → Matemática. O modo Documentos/calendário continua separado, dentro do Scan.

## O que funciona

- Leitura automática de uma expressão impressa em uma linha, com Tesseract.js em Web Worker no aparelho.
- Resultado após 2 leituras consistentes com escore OCR alto ou 3 com escore intermediário. Escore OCR não é garantia de acerto.
- Aritmética com frações exatas, decimais, potências, parênteses e equações lineares; sem `eval`.
- Motor simbólico Nerdamer isolado em Worker: derivadas, primitivas suportadas, simplificação, equações e isolamento de fórmulas.
- Uma função sem pergunta, como `f(x)=(x^3+6*x^2-3)/(x+4)`, não é derivada nem simplificada automaticamente. O aluno escolhe a operação. “Calcular valor de f(x)” pede o valor da variável: nesta função, `f(0)=-3/4`; `x=-4` é recusado. Simplificação precisa ser explícita; não presumir `f(x)=0`.
- Integral definida de polinômios em uma variável com limites finitos. Outras integrais definidas/impróprias são recusadas para evitar ignorar singularidades.
- Exemplos digitados: `x^3+sin(x)` / Derivada; `x^2` / Integral; `x^2-5*x+6=0` / Resolver; `F=m*a` / Resolver com variável `a`.
- Limite de 3 segundos no motor simbólico; respostas não resolvidas não são exibidas como solução. As explicações avançadas são um resumo da operação, não uma derivação completa de todas as regras algébricas.
- Pausa, retomada, edição da leitura, medição da leitura+cálculo e descarte de respostas incompatíveis com o quadro/operação atuais.
- O disparador e “Fotografar e ler” capturam uma imagem fixa para OCR local e revisão; não pausam uma tela vazia. Nenhuma foto é enviada por esse botão.
- Mostra o texto detectado mesmo quando ele não pode ser calculado. A assinatura de movimento compensa pequenos deslocamentos/exposição e é suavizada separadamente da imagem do OCR. Leituras lentas não precisam terminar todas dentro de dois segundos.
- Normaliza texto claro em fundo escuro e aceita sufixos `= ?`. Divisão com multiplicação implícita, como `8 ÷ 2(2 + 2) = ?`, pede agrupamento: `8/2*(2+2)` dá 16; `8/(2*(2+2))` dá 1. Não escolhe silenciosamente uma interpretação.

## Leitura assistida online

“Ler fórmula com IA” envia apenas o recorte ao backend (`POST /matematica/ler-formula`). O backend transcreve, não resolve nem salva fotos/fórmulas. O aluno revisa expressão, operação, variável e limites antes de calcular localmente.

Se uma foto já estiver na revisão, a IA recebe essa mesma imagem, não outro frame da câmera. Uma operação explicitamente selecionada pelo aluno prevalece sobre a sugestão da IA, com seus limites/variável preservados. O prompt diferencia `f(x)=...` de derivada e exige parênteses para agrupar numerador/denominador de frações empilhadas. Isso reduz ambiguidades, não garante acurácia universal.

Precisa publicar o backend e configurar `GROQ_API_KEY` e um `GROQ_VISION_MODEL` com visão. Chave ausente retorna 503; backend antigo retorna 404 com orientação na interface. Nenhuma chave entra no frontend. Tempo limite e validação de tamanho/formato evitam carregamento indefinido e arquivos inválidos.

## Limites honestos

- Não promete leitura instantânea de toda notação, manuscrito ou cálculo avançado. Expoentes, frações empilhadas e integrais 2D precisam de revisão/leitura assistida.
- O OCR pode confundir ou recusar símbolos legíveis para uma pessoa. Nos testes sintéticos, `*` chegou a ser lido como `%` e uma leitura de `8+8` veio com escore zero: ambas foram recusadas. Nunca substituir `%` por `*` silenciosamente para passar um teste.
- Regressão baseada na imagem enviada pelo usuário: o OCR inglês confunde `÷` com `+` e adiciona caracteres perto de `?`. O teste exige que a leitura incerta apareça para revisão, não finge reconhecimento correto dessa imagem. A confirmação dos dois agrupamentos é testada após edição explícita. Não foi medida acurácia em celular físico nem com a imagem original anexada, que não estava disponível como arquivo local.
- O primeiro uso baixa/inicializa o modelo. Os assets são servidos pelo próprio frontend e cacheados; sem chamadas de IA por frame. Não há histórico persistido deste modo.
- Fórmulas com parâmetros dependem de restrições de domínio; soluções transcendentes podem não ser exaustivas. Avisos acompanham a saída.
- Testes de navegador usam OCR real sobre vídeo sintético. Não são medição de acurácia ou latência em celular físico.

## Validar

`npm ci` e `npm run build` geram os assets locais via `scripts/prepare-math-ocr.mjs` (dependências e modelos fixados pelo lockfile). Não é preciso comitar os binários gerados.

`npm test` inclui `npm run test:math`. Para navegador, disponibilize Playwright/Chromium e execute `MATH_TEST_SERVER=1 npm run test:math:camera` após o build. `PLAYWRIGHT_PACKAGE`, `CHROMIUM_PATH` e `MATH_SCREENSHOT_DIR` são opcionais.

Para testar a integração REAL pela câmera: `MATH_TEST_REAL_API=1 npm run test:math:ia`. Cada execução permite só uma chamada de IA e intercepta as outras rotas do backend para não consumir lembretes nem acessar dados reais. O padrão é a conta ambígua em fundo escuro; `MATH_TEST_IA_CASO=derivada`, `integral` ou `fracao` seleciona os demais cenários. Exige Playwright/Chromium, usa vídeo sintético e consome cota do provedor. Não roda em `npm test`.

No backend: `python -m pytest -q tests/test_matematica.py` (respostas do provedor simuladas). Nenhum dado real é persistido nos testes.

Validação de produção em 09/09/2026: a tradução de uma imagem impressa simples respondeu 200 enquanto a chamada matemática falhou. A leitura matemática foi alinhada ao contrato de visão da tradução; ainda houve resposta incompatível com o schema e limite do provedor (429). Não considerar leitura com IA pronta apenas por merge/build. `X-Math-Invalid-Fields` informa somente nomes de campos rejeitados, sem valores nem fotos, para diagnóstico.

Após corrigir a variável inaplicável em contas numéricas, a API real devolveu `8/2(2+2)` com HTTP 200 em 2,4 s. O fluxo completo no frontend publicado, com captura de vídeo sintético e IA real, passou em viewport 390px: transcrição em 5,09 s, revisão obrigatória e escolha explícita dos agrupamentos com resultados 16/1. Isso não mede reconhecimento da imagem original anexada nem a velocidade em celular físico. O teste extra de derivada inicialmente terminou sem transcrição; deve ser verificado separadamente, não inferido do sucesso aritmético.

Antes de prometer latência: testar primeira abertura e motor aquecido no celular JOVI, boa/baixa luz, símbolos parecidos, movimento, troca de câmera, modo avião após carregar os assets, cancelamento e notação ilegível. Comparar expressão lida e resposta, não só o cronômetro.

Dependências: Tesseract.js/core Apache-2.0, dados empacotados `@tesseract.js-data/eng` MIT, Nerdamer MIT. O preparo distribui também os avisos/licenças disponíveis nos pacotes.
