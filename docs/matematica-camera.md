# Matemática por foto com IA

Acesso: câmera → SCAN → Matemática.

## Fluxo

1. Enquadre a expressão inteira e toque no disparador ou em “Fotografar e ler com IA”.
2. `POST /matematica/ler-formula` transcreve a foto. Confira a expressão, operação, variável e limites.
3. “Resolver com IA · passo a passo” envia apenas a expressão revisada para `POST /matematica/resolver`.
4. O resultado e os passos ficam visíveis: título, explicação da regra e transformação matemática. A IA também pode pedir informação ou dizer que não conseguiu resolver.

Não existe detecção ao vivo, download de OCR, leitura local de foto ou cálculo local nesse fluxo. Não há solicitações por frame. “Reler esta foto” usa a mesma imagem, mesmo após mover o celular. “Nova foto” descarta a captura em memória. Nenhum conteúdo matemático é salvo no banco.

Operações: automática (contas/equações), simplificar, calcular f(x) em um valor, derivada, integral, integral definida e resolver equação. A operação escolhida prevalece sobre a sugestão da transcrição. Uma função sem pedido não deve ser interpretada como derivada ou f(x)=0. Divisão com multiplicação implícita pede agrupamento explícito antes da resolução.

## Servidor e limites

Requer internet e backend atualizado com `GROQ_API_KEY`, `GROQ_VISION_MODEL` (leitura) e `GROQ_MODEL` (resolução). O frontend nunca recebe credenciais. Leitura limitada a 2 MB/4 megapixels; resolução recebe JSON limitado. Os pedidos têm prazos e concorrência limitada. Erros do provedor são sanitizados.

Sem resposta completa, não exibir resultado parcial: a resolução exige resultado e passos válidos. Falhas, 429 e cancelamento não acionam cálculo local ou repetição automática. Foto/expressão permanecem na revisão após falha; cancelar/nova foto descarta a revisão. Respostas tardias não reabrem a tela.

Validação de estrutura não é prova de correção matemática. A IA pode errar símbolos, passos, domínio ou resultados. Não prometer resolução instantânea/universal, especialmente para manuscritos e integrais difíceis. Os passos são uma explicação didática, não acesso a raciocínio interno do modelo.

## Testes

- `npm ci`, `npm run build`, `npm test`.
- `MATH_TEST_SERVER=1 npm run test:math:camera`: navegador com câmera/IA simuladas; verifica ausência de OCR, Workers e envios automáticos, confirmação, foto fixa, operação, passos, dados faltantes, erros e cancelamento em 390/1280px. Exige Playwright/Chromium (`PLAYWRIGHT_PACKAGE`, `CHROMIUM_PATH` opcionais).
- `MATH_TEST_REAL_API=1 npm run test:math:ia`: opt-in que consome cota real; até uma transcrição e uma resolução por execução, vídeo sintético, demais rotas isoladas. Não roda em `npm test` e não mede câmera física.
- Backend: `python -m pytest -q tests/test_matematica.py` usa IA simulada e não persiste dados.

Os motores matemáticos antigos permanecem como módulos auxiliares/testados, mas não são carregados nem usados pela câmera. O leitor Tesseract e seu preparo foram removidos deste projeto. Não confundir os testes desses módulos antigos com validação do resultado gerado pela IA.
