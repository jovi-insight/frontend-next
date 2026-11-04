JOVI INSIGHT  /  SPRINT 4

Software e Total
Experience Design

Avaliação heurística da câmera, backlog do produto e relatório de descrição detalhada do escopo.

**Projeto:** Jovi Insight

**Integrantes:**

| Integrante | RM |
| --- | --- |
| Alisson Gomes Pereira | RM573681 |
| Gustavo Teotonio Silva | RM572803 |
| Guilherme Vidichosqui Men | RM570269 |
| Matheus Tasso Djamdjian | RM570716 |
| Vitor Kenji Kawaguchi Iwagoe Indiani | RM569329 |

**Disciplina:** Software e Total Experience Design

**Documento:** revisado em 14 de outubro de 2026

BASE DA ENTREGA

Análise do PDF original e inspeção estática do frontend disponível no repositório. Os recursos identificados no código são distinguidos de melhorias propostas e de integrações que dependem de validação com o backend e os dispositivos.

A revisão não representa teste com usuários, auditoria de acessibilidade nem homologação de produção. Não foram atribuídas métricas de uso ou resultados de testes não realizados.


---

# 01  Síntese, método e cobertura

O Jovi Insight apoia estudantes na captura de lousas, cadernos e slides, na organização dos materiais e na revisão do conteúdo. A câmera é a entrada principal: o estudante enquadra, captura, revisa páginas, solicita leitura e organiza o resultado. Recursos de estudo, calendário e acessibilidade complementam essa jornada.

| Critério da Sprint 4 | Peso | Onde consultar |
| --- | --- | --- |
| 10 Heurísticas de Nielsen | 4,00 | Seção 02 — H01 a H10 |
| Backlog do Produto | 3,00 | Seção 03 — B01 a B20 |
| Descrição detalhada do escopo | 3,00 | Seção 04 — contexto, requisitos e limites |

## Conferência com o enunciado

Os três critérios estão contemplados na estrutura documental: dez heurísticas aplicadas à jornada da câmera (4,00 pontos), vinte itens de backlog com descrição, prioridade e valor para usuário e negócio (3,00 pontos), e relatório de escopo com contexto, problema, objetivos, público-alvo, solução, funcionalidades, requisitos, entregáveis, premissas, restrições e limites (3,00 pontos). Os pesos totalizam 10,00 pontos; cobertura documental não equivale a nota garantida.

A principal limitação é de evidência: esta é uma avaliação por inspeção estática, sem observação da interface em funcionamento ou sessões com usuários nesta revisão. Para sustentar uma avaliação completa da solução em uso, ainda é necessário executar o plano de validação, sobretudo os cenários visuais, de teclado, leitor de tela e dispositivos. As verificações de aceite são propostas, não resultados obtidos.

## Método de avaliação

Foram lidos o PDF de seis páginas, o README e os arquivos indicados nas evidências. A inspeção acompanha abertura da câmera, permissões, escolha de modo, captura multipágina, prévia, descarte, processamento, organização e recuperação. Vídeo, Libras e matemática são considerados modos complementares; biblioteca e estudo são avaliados quando afetam a continuidade da captura.

Cada heurística apresenta um ponto favorável, um problema ou risco, o impacto esperado, uma melhoria e uma verificação proposta. As severidades são preliminares: frequência e persistência em uso real não foram medidas. A escala usada é 0 = sem problema; 1 = cosmético; 2 = menor; 3 = maior; 4 = catastrófico. A severidade classifica o achado, não a heurística inteira [R1–R2].

## Estados usados neste documento

Presente no código: fluxo identificado por inspeção, sem afirmar sucesso operacional. Dependente de integração/dispositivo: exige serviço remoto, rede, permissão ou API compatível. Proposto: melhoria ainda não evidenciada no fluxo examinado. Fora do recorte: evolução não incluída na entrega atual.

## Correções em relação ao PDF anterior

O cliente de API e a biblioteca consultam backend; OCR, resumo, quiz, tradução e calendário têm chamadas remotas. Portanto, não são descritos como exclusivamente locais ou apenas demonstrativos. A autenticação permanece fora da entrega comprovada: /login redireciona e GuardaSessao não bloqueia acesso. Libras é soletração de letras, não tradução de frases sinalizadas. Instalação PWA não comprova operação integral offline.


---

# 02  Avaliação heurística da câmera

Achados 01–02 de 10 | inspeção estática

## H01 · Visibilidade do estado do sistema

**Severidade:** 2 — menor

**Evidência:** app/page.tsx: concluirAula, estados ocupado e tira-paginas; components/CameraDrawers.tsx: GavetaQualidade.

**Ponto favorável:** O fluxo informa a página em leitura, novas tentativas e processamento; a gaveta de qualidade mostra a resolução efetivamente entregue pela câmera.

**Achado e impacto:** A sobreposição de processamento mostra texto, mas não declara role="status" ou aria-live. Há risco de o progresso não ser anunciado por leitor de tela, mesmo com avisos acessíveis em outros trechos. Além disso, concluirAula exibe “Salvando” antes da escolha da matéria e da persistência em app/organize/page.tsx; nesse ponto há preparação local e transferência de imagens em memória. O estudante pode repetir uma ação, interpretar a espera como travamento ou acreditar que o conteúdo já foi salvo no backend. O impacto depende da tecnologia assistiva e deve ser reproduzido.

**Melhoria proposta:** Anunciar início, mudança de etapa e conclusão de forma não intrusiva; diferenciar captura em memória, processamento e persistência confirmada. Manter as páginas visíveis após falha.

**Verificação de aceite:** Com leitor de tela, processar três páginas e verificar anúncio de etapa e resultado sem repetição excessiva. Simular falha e confirmar que a mensagem não anuncia salvamento inexistente.

Rastreabilidade: B03

## H02 · Correspondência com o mundo real

**Severidade:** 2 — menor

**Evidência:** app/page.tsx: MODOS e scan-tools; components/CameraDrawers.tsx: GavetaQualidade; README.md: Libras.

**Ponto favorável:** Foto, Vídeo, páginas e matérias se aproximam das tarefas do estudante. O SCAN oferece a descrição “Texto, matéria e datas em uma só captura”.

**Achado e impacto:** Os termos SCAN, fps e qps exigem conhecimento adicional. O nome LIBRAS, isolado, pode criar expectativa de tradução de uma conversa, acima do escopo de soletração descrito no README. A expectativa incorreta pode levar à escolha de modo inadequado e à frustração com o resultado.

**Melhoria proposta:** Apresentar “Digitalizar documentos”, explicar taxa de quadros e incluir “Soletrar letras em Libras” como descrição do modo. Informar que a leitura automática precisa de conferência.

**Verificação de aceite:** Em uma avaliação futura, pedir ao participante que escolha um modo para digitalizar uma página e outro para soletrar letras. Registrar entendimento dos rótulos e corrigir ambiguidades antes do aceite.

Rastreabilidade: B07, B15


---

# 02  Avaliação heurística da câmera

Achados 03–04 de 10 | inspeção estática

## H03 · Controle e liberdade do usuário

**Severidade:** 3 — maior

**Evidência:** app/page.tsx: tira-remover, removerPagina e troca de modo; app/library/page.tsx: aplicar.

**Ponto favorável:** Há prévia, remoção de páginas e confirmação ao trocar de modo com capturas pendentes. A biblioteca oferece lixeira e restauração para conteúdo salvo.

**Achado e impacto:** Na tira de captura, remover uma página atualiza diretamente a lista, sem uma ação de desfazer nesse fluxo. A restauração da biblioteca não recupera essa captura ainda não salva. Um toque acidental pode exigir refazer a foto; em uma aula, a lousa pode já ter mudado.

**Melhoria proposta:** Oferecer desfazer o descarte da captura e manter o rascunho até sua conclusão explícita. Distinguir apagar uma página pendente de enviar um documento salvo à lixeira.

**Verificação de aceite:** Capturar três páginas, descartar a segunda e desfazer. Conferir imagem, ordem e estado de leitura; fechar a prévia deve preservar as demais páginas.

Rastreabilidade: B01, B02

## H04 · Consistência e padrões

**Severidade:** 2 — menor

**Evidência:** app/page.tsx: tira-item, modal de prévia e botões de navegação; components/CameraDrawers.tsx.

**Ponto favorável:** Botões de modos e ajustes utilizam estados selecionados; a prévia tem botões nomeados para avançar, voltar e fechar.

**Achado e impacto:** A miniatura que abre a prévia é um div com onClick, sem semântica de botão nem suporte explícito de teclado nesse elemento. A mesma intenção de abrir usa padrões de interação diferentes. Quem navega por teclado pode não alcançar a prévia da captura, embora consiga acionar outros controles.

**Melhoria proposta:** Transformar o acionador da prévia em controle semântico, sem aninhar o botão de descarte; padronizar foco, nomes e acionamento por Enter/Espaço.

**Verificação de aceite:** Percorrer as capturas com Tab, abrir a segunda por teclado, fechar a prévia e verificar retorno do foco ao acionador. Conferir os nomes anunciados pelo leitor de tela.

Rastreabilidade: B04


---

# 02  Avaliação heurística da câmera

Achados 05–06 de 10 | inspeção estática

## H05 · Prevenção de erros

**Severidade:** 3 — maior

**Evidência:** app/page.tsx: estado paginas, efeito beforeunload, janelaDeAula.blobs e concluirAula.

**Ponto favorável:** Existe aviso de saída quando há páginas pendentes e bloqueio de algumas ações incompatíveis durante o processamento.

**Achado e impacto:** As capturas permanecem em memória antes da conclusão. O aviso de saída não garante recuperação após encerramento inesperado, descarte da aba pelo sistema ou recarga confirmada. A perda de várias páginas compromete a tarefa principal e exige repetir uma captura que pode não estar mais disponível.

**Melhoria proposta:** Persistir rascunho com imagens, ordem e estados; restaurar após reabertura e remover apenas quando houver confirmação do destino. Tratar falta de espaço sem prometer que o rascunho foi salvo.

**Verificação de aceite:** Capturar três páginas, recarregar e reabrir a aplicação. Restaurar as três na mesma ordem. Simular falta de espaço e exigir alerta claro, preservando a sessão enquanto estiver aberta.

Rastreabilidade: B01

## H06 · Reconhecimento em vez de memorização

**Severidade:** 2 — menor

**Evidência:** app/page.tsx: tira-paginas, tira-alerta e MODOS; app/library/page.tsx: agrupamento por matéria e carregamento paginado.

**Ponto favorável:** Miniaturas numeradas ajudam a reconhecer a sequência capturada. A biblioteca agrupa fotos por matéria e permite consultar a lixeira.

**Achado e impacto:** Na câmera, a falha da miniatura usa ícone com title="Não foi possível ler", sem instrução textual persistente de recuperação junto à página; sua compreensão por toque e leitor de tela exige validação. O estudante pode precisar lembrar qual página falhou e como retomar. Na continuidade da jornada, a tela de biblioteca examinada não tem busca textual ou filtro explícito por período. Encontrar uma captura antiga depende de percorrer os grupos e as páginas de resultados. À medida que a coleção cresce, o estudante precisa lembrar matéria e posição aproximada do material, aumentando o esforço de recuperação.

**Melhoria proposta:** Exibir estado e próxima ação de leitura junto à página, com nome acessível. Adicionar busca por título/texto disponível e filtros de matéria e período, com indicação de filtros ativos e ação de limpar. A busca deve abranger a coleção remota, não só a página carregada.

**Verificação de aceite:** Provocar falha na segunda captura e verificar identificação da página e da ação de retomada sem depender de tooltip. Em uma base de teste com pelo menos 50 itens, localizar um documento fora da primeira página por matéria e data; limpar filtros e conferir restauração da lista.

Rastreabilidade: B03, B05, B10


---

# 02  Avaliação heurística da câmera

Achados 07–08 de 10 | inspeção estática

## H07 · Flexibilidade e eficiência de uso

**Severidade:** 2 — menor

**Evidência:** app/page.tsx: aoIniciarGestoZoom, shutter-zoom-readout e captura multipágina; lib/use-camera.ts: ajustarZoom.

**Ponto favorável:** A captura em lote evita organizar uma página por vez. O zoom por arraste favorece operação com uma mão e se adapta à capacidade da câmera.

**Achado e impacto:** O controle de zoom depende de um gesto que pode não ser descoberto ou executado por todos. O indicador do valor não constitui, por si só, alternativa de ajuste por teclado. Pessoas com dificuldade motora ou sem experiência com o gesto podem precisar mover o aparelho para obter o enquadramento.

**Melhoria proposta:** Oferecer controle de zoom acessível por teclado e toque, com mínimo/máximo compatíveis, além de uma pista breve sobre o gesto. Preservar consistência entre prévia e imagem capturada.

**Verificação de aceite:** Ajustar o zoom sem arrastar o visor, capturar e conferir enquadramento. Validar câmera com zoom nativo e fallback digital, sem ultrapassar seus limites.

Rastreabilidade: B08

## H08 · Estética e design minimalista

**Severidade:** 2 — menor, a validar visualmente

**Evidência:** app/page.tsx: controles superiores, MODOS, scan-tools e tira-paginas; components/CameraDrawers.tsx.

**Ponto favorável:** Configurações secundárias ficam em gavetas, enquanto o disparador ocupa posição própria na jornada.

**Achado e impacto:** Cinco modos, opções do SCAN, ajustes e miniaturas podem disputar espaço no visor em telas pequenas. Trata-se de risco inferido da composição, não de sobreposição comprovada em teste visual. Excesso de elementos pode reduzir a área útil para enquadrar a página ou dificultar a identificação da próxima ação.

**Melhoria proposta:** Priorizar visor, disparador e conclusão; recolher opções secundárias sem ocultar estado de processamento ou quantidade de páginas. Verificar ampliação de texto e orientações de tela.

**Verificação de aceite:** Em larguras de 360 e 390 px, com texto ampliado, confirmar que disparador, concluir e descarte permanecem acessíveis e sem sobreposição. Registrar capturas de tela na homologação.

Rastreabilidade: B09


---

# 02  Avaliação heurística da câmera

Achados 09–10 de 10 | inspeção estática

## H09 · Reconhecimento, diagnóstico e recuperação de erros

**Severidade:** 3 — maior

**Evidência:** lib/use-camera.ts: tratamento de erros; app/page.tsx: concluirAula, bloco falhas === lidas.length.

**Ponto favorável:** A câmera diferencia permissão negada, dispositivo ausente e qualidade não suportada. Falhas de leitura mantêm as fotos disponíveis na sessão.

**Achado e impacto:** Quando todas as páginas falham, a mensagem atribui a causa provável à cota de IA, embora a falha também possa ser de rede ou servidor. O texto ainda fixa um limite que pode variar. O usuário pode esperar sem necessidade ou tentar uma solução inadequada, prolongando o bloqueio da tarefa.

**Melhoria proposta:** Mapear a causa recebida para instruções específicas: reconectar, aguardar limite informado pelo serviço ou tentar novamente. Oferecer retomada das páginas que falharam e não descartar as válidas.

**Verificação de aceite:** Simular desconexão, limite de uso e erro de servidor; conferir mensagens diferentes, fotos preservadas e nova tentativa após recuperação, sem duplicar conteúdos.

Rastreabilidade: B05

## H10 · Ajuda e documentação

**Severidade:** 2 — menor

**Evidência:** app/page.tsx: instrução inicial do SCAN; components/CameraDrawers.tsx: notas de flash; README.md.

**Ponto favorável:** O SCAN apresenta uma explicação breve, e o flash informa quando há fallback de iluminação pela tela.

**Achado e impacto:** Não foi identificado, no fluxo de câmera examinado, um ponto único de ajuda que reúna captura, permissão, processamento remoto, recuperação e limites de Libras. O README atende principalmente à equipe técnica. Estudantes iniciantes podem depender de auxílio externo para concluir a captura ou entender por que um recurso não está disponível.

**Melhoria proposta:** Adicionar ajuda contextual curta por modo, acessível durante o uso: enquadrar, capturar, revisar e concluir; incluir recuperação de permissões, destino dos dados e dependência de rede.

**Verificação de aceite:** Um participante deve encontrar a orientação a partir da câmera e voltar à captura sem perder páginas. Validar leitura por teclado e leitor de tela; registrar dúvidas persistentes.

Rastreabilidade: B06


---

# 03  Backlog do produto

O backlog reúne melhorias e capacidades existentes que precisam de validação. Os itens foram reestruturados nesta revisão; B01–B20 substituem a numeração do PDF original. “Presente” não significa homologado. Os critérios abaixo são condições propostas para considerar cada item aceito, não resultados já obtidos.

## Critério de priorização e valor

MoSCoW: Must = necessário ao fluxo confiável de captura e consulta; Should = ganho relevante de compreensão, acesso ou estudo; Could = ampliação após estabilização; Won’t now = fora do recorte. Dentro de cada classe, vêm primeiro perda de dados, bloqueios e acesso à tarefa principal. Valor de negócio significa confiança, adoção e menor necessidade de suporte, sem assumir receita ou métricas medidas.

| Ordem | Item | Prioridade / situação |
| --- | --- | --- |
| 1–5 | B01 rascunho; B02 desfazer; B03 progresso; B04 teclado; B05 erros | Must / melhorias propostas ou parciais |
| 6–9 | B11 captura; B12 OCR e organização; B13 biblioteca; B14 estudo | Must / código presente, validar integração |
| 10–15 | B06 ajuda; B07 linguagem; B08 zoom; B09 visor; B10 busca; B15 Libras | Should / melhorias e validação |
| 16–18 | B16 vídeo/aula; B17 calendário; B18 matemática | Should / código presente, validar |
| 19 | B19 sincronização entre dispositivos | Could / futuro |
| 20 | B20 cliente nativo e limpeza de galeria | Won’t now / fora do recorte |

## Planejamento das próximas etapas

Etapa 1: B01–B05, acompanhados dos cenários de captura, organização e biblioteca B11–B13. Etapa 2: B06–B10 e validação de B14–B18. B19 depende de identidade e isolamento de dados, cuja arquitetura ainda deve ser definida. B20 exige uma iniciativa própria. A ordem é de valor e risco; dependências técnicas podem exigir execução conjunta.

Não se atribuem prazos ou estimativas sem capacidade conhecida da equipe. Antes de uma implementação, o responsável pelo produto deve refinar cada item com desenvolvimento e design. O aceite deve guardar evidência do cenário, ambiente, resultado e defeitos encontrados.

## Critério geral de conclusão

Um item só deve ser encerrado quando os critérios forem demonstrados, as mensagens e estados de falha forem revisados e a documentação refletir os limites reais. Fluxos remotos exigem backend disponível; fluxos de mídia exigem o dispositivo-alvo. Uma inspeção do código, isoladamente, não satisfaz esse aceite.


---

# 03  Backlog detalhado · 01–05

## B01 · Persistir e retomar captura multipágina

Must · ordem 1 · proposto · H03/H05

Como estudante, quero recuperar a sessão interrompida para não fotografar todo o material novamente. Persistir imagens, ordem e estado das páginas e oferecer retomada ou descarte explícito.

Usuário: evita perda de trabalho. Negócio: protege a confiança no fluxo principal.

Aceite: Após recarregar ou reabrir, recuperar três páginas na mesma ordem; falta de espaço gera aviso sem falsa confirmação; limpar rascunho somente após confirmação de salvamento ou descarte.

Dependências: Depende de estratégia de armazenamento local e do ponto de confirmação de B12.

## B02 · Desfazer descarte de página pendente

Must · ordem 2 · proposto · H03

Como estudante, quero desfazer um descarte acidental antes de concluir a captura. Manter referência recuperável da página e da sua posição.

Usuário: corrige toques acidentais. Negócio: reduz abandono e pedidos de suporte.

Aceite: Remover a segunda de três páginas e desfazer restaura imagem, posição e estado; fechar a prévia não remove conteúdo; a ação é acessível por teclado.

Dependências: Integrar com o ciclo de vida do rascunho B01.

## B03 · Comunicar progresso e persistência de forma acessível

Must · ordem 3 · parcial no código · H01

Como estudante, quero saber se o sistema captura, lê ou salva. Padronizar mensagens visuais e anúncios acessíveis de início, etapa, conclusão e falha.

Usuário: entende a espera e evita repetição. Negócio: reduz incerteza e operações duplicadas.

Aceite: Anunciar página atual e total sem excesso de interrupções; identificar falha e ação de retomada junto à miniatura sem depender de tooltip; distinguir rascunho de conteúdo salvo; apresentar conclusão somente após resposta de sucesso do destino.

Dependências: Depende dos estados de B11/B12 e do tratamento de B05.

## B04 · Tornar a prévia operável por teclado

Must · ordem 4 · proposto · H04

Como usuário de teclado ou leitor de tela, quero abrir e revisar cada captura. Usar acionadores semânticos, foco visível e retorno de foco ao fechar.

Usuário: acesso independente à revisão. Negócio: amplia o público capaz de concluir a tarefa.

Aceite: Tab alcança cada miniatura; Enter/Espaço abre; fechar devolve foco; o botão de descarte permanece separado e identificado; não há armadilha de foco.

Dependências: Depende da estrutura da tira e do modal de prévia de B11.

## B05 · Recuperar falhas de leitura com causa correta

Must · ordem 5 · parcial no código · H09

Como estudante, quero instruções adequadas para recuperar uma falha. Diferenciar rede, limite de uso e servidor; permitir retomar páginas com erro sem refazer as válidas.

Usuário: recupera a tarefa com menos esforço. Negócio: reduz suporte e chamadas desnecessárias.

Aceite: Simular três causas de erro e obter ações distintas; nenhuma foto é perdida; nova tentativa não duplica conteúdo nem informa limite fixo sem confirmação do serviço.

Dependências: Depende do contrato de erros da API e de B01/B12.


---

# 03  Backlog detalhado · 06–10

## B06 · Ajuda contextual da câmera

Should · ordem 10 · proposto · H10

Como iniciante, quero consultar instruções curtas sem abandonar a captura. Cobrir enquadramento, permissões, revisão, processamento remoto e retomada.

Usuário: aprende durante a tarefa. Negócio: facilita adoção e reduz dúvidas recorrentes.

Aceite: Acessar ajuda de cada modo e voltar sem perder páginas; localizar passos de permissão negada e perda de rede; ajuda funciona por teclado e leitor de tela.

Dependências: Depende de linguagem B07 e comportamento definitivo de B01/B05.

## B07 · Revisar nomes e expectativas dos modos

Should · ordem 11 · proposto · H02

Como estudante, quero entender o que cada modo entrega. Explicar SCAN, qualidade e soletração em Libras, incluindo a necessidade de revisar resultados automáticos.

Usuário: escolhe a ferramenta adequada. Negócio: evita expectativas de funções não entregues.

Aceite: Cada modo tem descrição curta e coerente com o resultado; Libras explicita letras; a interface diferencia qualidade solicitada da efetiva; realizar verificação de compreensão.

Dependências: Validar terminologia junto com B06 e B15.

## B08 · Alternativa acessível ao gesto de zoom

Should · ordem 12 · proposto · H07

Como estudante, quero ajustar o zoom por controle visível ou teclado. Preservar o gesto existente e mostrar valor e limites disponíveis.

Usuário: enquadra sem depender de destreza no gesto. Negócio: amplia uso em diferentes condições.

Aceite: Ajustar sem arraste; respeitar limites; prévia e captura têm enquadramento equivalente; testar zoom nativo e fallback digital.

Dependências: Depende das capacidades expostas em use-camera e da captura B11.

## B09 · Organizar os controles em telas pequenas

Should · ordem 13 · proposto · H08

Como estudante no celular, quero enquadrar e concluir sem controles encobrindo a tarefa. Revisar hierarquia visual e recolhimento dos ajustes secundários.

Usuário: identifica a próxima ação. Negócio: melhora a experiência móvel da solução.

Aceite: Em 360 e 390 px e texto ampliado, disparador, conclusão e descarte ficam acessíveis, sem sobreposição; configurações permanecem localizáveis.

Dependências: Executar avaliação visual da composição com B03/B08.

## B10 · Buscar e filtrar materiais capturados

Should · ordem 14 · proposto · H06

Como estudante, quero reencontrar uma captura por texto, matéria ou período. Adicionar busca e filtros sobre a coleção completa, com limpar e estado sem resultados.

Usuário: reduz esforço de revisão. Negócio: aumenta utilidade recorrente da biblioteca.

Aceite: Localizar item além da primeira página numa base com 50 registros; combinar matéria e período; limpar filtros; diferenciar vazio de erro de rede.

Dependências: Depende de B13 e suporte de consulta no backend.


---

# 03  Backlog detalhado · 11–15

## B11 · Validar captura e revisão de páginas

Must · ordem 6 · presente, condicionado ao dispositivo

Como estudante, quero capturar páginas legíveis e revisá-las antes de organizar. Validar câmera, troca de lado, flash compatível, prévia e captura em lote.

Usuário: registra o conteúdo acadêmico. Negócio: sustenta a proposta central do produto.

Aceite: Em aparelho compatível, capturar três páginas e revisar ordem e enquadramento; permissão negada mostra orientação; recurso sem suporte informa alternativa; sair encerra o stream.

Dependências: Depende de HTTPS ou localhost, câmera e permissão. Consolidar com B01–B05.

## B12 · Validar OCR e organização remotos

Must · ordem 7 · presente, dependente de integração

Como estudante, quero transformar imagens em conteúdo e escolher matéria/pasta. Validar leitura, revisão, sugestão de matéria e persistência pelo backend.

Usuário: transforma captura em material consultável. Negócio: diferencia a solução de uma galeria comum.

Aceite: Ler conjunto conhecido de imagens, conferir texto e salvar no destino escolhido; recarregar e consultar o conteúdo; falha preserva capturas; sugestão pode ser corrigida.

Dependências: Depende da API disponível, de B11 e dos tratamentos B01/B05.

## B13 · Validar biblioteca, pastas e lixeira

Must · ordem 8 · presente, dependente de integração

Como estudante, quero consultar e organizar conteúdos e recuperar descartes salvos. Validar paginação, associação a pastas, restauração e exclusão definitiva.

Usuário: mantém acervo organizado e recuperável. Negócio: sustenta continuidade de uso.

Aceite: Criar conteúdo, recarregar, localizar e mover à lixeira; restaurar; exigir confirmação de exclusão definitiva; falha parcial não remove da tela itens cuja ação falhou.

Dependências: Depende das rotas de biblioteca e organização e do conteúdo de B12.

## B14 · Validar estudo e personalização acessível

Must · ordem 9 · presente, integração/dispositivo

Como estudante, quero revisar material por resumo, quiz, tradução, narração e Modo Foco. Validar resultados remotos e aplicação dos perfis de leitura.

Usuário: adapta a revisão às suas necessidades. Negócio: entrega valor além da captura.

Aceite: Gerar resumo e quiz de conteúdo conhecido, mostrar erro e nova tentativa; traduzir; aplicar perfil e recarregar; indicar indisponibilidade de voz sem bloquear a leitura textual.

Dependências: Depende de B12, serviços de estudo, narração remota e fallback de voz do navegador; verificar teclado e leitura assistiva.

## B15 · Validar soletração em Libras e seus limites

Should · ordem 15 · presente, condicionado

Como usuário, quero formar texto a partir de letras reconhecidas pela câmera. Validar enquadramento, estabilidade, calibração e indicação da cobertura do modelo.

Usuário: conhece o alcance do recurso. Negócio: promove inclusão com expectativas verificáveis.

Aceite: Exibir letras cobertas e orientação; conferir confirmar/apagar letra e separar palavras; testar movimentos das letras dinâmicas suportadas; não anunciar tradução de frases sinalizadas.

Dependências: Depende de câmera, modelo e validação com pessoas que utilizam Libras; não inferir precisão sem medição.


---

# 03  Backlog detalhado · 16–20

## B16 · Validar gravação e acompanhamento de aula

Should · ordem 16 · presente, integração/dispositivo

Como estudante, quero registrar e rever uma aula com vídeo e transcrição quando suportados. Validar gravação, biblioteca de mídia, reprodução e recuperação de falhas. A mídia possui cópia em IndexedDB e fluxo de envio/consulta no backend; isso não comprova sincronização isolada por conta entre dispositivos (B19).

Usuário: revisita explicações. Negócio: amplia a cobertura da rotina acadêmica.

Aceite: Gravar e reproduzir amostra com áudio autorizado; verificar sincronização de transcrição quando disponível; testar recusa de microfone e indisponibilidade de armazenamento; conferir estados de envio pendente/sincronizado e retomada sem duplicação no backend.

Dependências: Depende das APIs de mídia, espaço local e serviços remotos utilizados no fluxo.

## B17 · Validar calendário acadêmico e sugestões do SCAN

Should · ordem 17 · presente, dependente de integração

Como estudante, quero revisar datas detectadas e salvar compromissos. Validar criação manual, confirmação de sugestões, edição, vínculos e lembretes configurados.

Usuário: organiza prazos de estudo. Negócio: conecta captura e planejamento recorrente.

Aceite: Revisar uma data sugerida, corrigir e confirmar; recarregar e consultar no calendário; cancelar sugestão não cria evento; testar lembrete no ambiente suportado.

Dependências: Depende das rotas de calendário, B12 e permissões de notificação quando aplicáveis.

## B18 · Validar matemática pela câmera

Should · ordem 18 · presente, condicionado

Como estudante, quero capturar uma expressão e conferir a leitura antes de usar a resolução. Validar interpretação, edição e apresentação do resultado.

Usuário: apoia revisão de exercícios. Negócio: amplia o valor educacional do SCAN.

Aceite: Capturar expressão de referência, conferir e corrigir leitura; comparar resultado com referência conhecida; entrada não suportada mostra limite sem inventar uma solução.

Dependências: Depende de captura, motores matemáticos e serviços de leitura; não promete resolver qualquer exercício.

## B19 · Sincronização entre dispositivos com identidade

Could · ordem 19 · futuro

Como estudante, quero recuperar meus materiais em outro dispositivo. Definir identidade, isolamento de dados, conflitos e sincronização; a existência de backend não comprova esse fluxo.

Usuário: continuidade entre aparelhos. Negócio: habilita evolução para contas individuais.

Aceite: Após definir autenticação, criar material num dispositivo e recuperá-lo em outro com a mesma conta; outra conta não acessa o conteúdo; conflito possui regra documentada.

Dependências: Depende de arquitetura de identidade, autorização e persistência do backend. Fora da homologação atual.

## B20 · Cliente nativo e limpeza da galeria do aparelho

Won’t now · ordem 20 · fora do recorte

Como estudante, quero avaliar uma futura opção de remover fotos já organizadas da galeria. Investigar viabilidade em aplicativo nativo e controle explícito de seleção.

Usuário: possível redução de duplicatas. Negócio: evolução da visão “Lê e Limpa”.

Aceite: Somente em projeto futuro: confirmar material salvo, solicitar permissão e mostrar prévia dos arquivos escolhidos antes de qualquer exclusão; recusa não deve apagar conteúdo.

Dependências: Depende de novo escopo, plataforma nativa e validação própria; não será implementado pela PWA desta entrega.


---

# 04  Descrição detalhada do escopo

## 4.1 Contexto, problema e objetivos

Materiais fotografados em aula tendem a se dispersar entre a galeria do aparelho e anotações. Reencontrar o conteúdo, extrair texto e preparar a revisão exige etapas separadas. O projeto busca reunir essas tarefas numa aplicação web centrada na câmera, com organização acadêmica e diferentes formas de leitura.

Objetivo geral: apoiar o percurso entre captura e revisão do material acadêmico. Objetivos específicos: registrar páginas com revisão; associar conteúdos a matérias e pastas; disponibilizar leitura automática e recursos de estudo; permitir recuperação de descartes; oferecer personalização de acesso; conectar datas detectadas ao planejamento do estudante. Ganhos de tempo e aprendizagem são hipóteses de valor, não resultados medidos.

## 4.2 Público-alvo e envolvidos

Público principal: estudantes que fotografam materiais e revisam conteúdos com frequência. Públicos complementares: Ensino Médio, graduação, EJA, concurseiros e autodidatas. Os perfis de acessibilidade contemplam necessidades de leitura, contraste, atenção e comunicação; não substituem avaliação com os usuários desses recursos. A equipe acadêmica desenvolve e documenta; o responsável pelo produto prioriza; a avaliação docente verifica a entrega.

## 4.3 Solução e jornada principal

A solução é uma aplicação Next.js/React/TypeScript com recursos de PWA. O estudante abre a câmera, concede a permissão, escolhe o modo, enquadra e captura. Em SCAN, acumula páginas e revisa a prévia; ao concluir, o frontend solicita análise de imagens, apresenta resultados e segue para organização. Conteúdos salvos alimentam biblioteca, resumo e quiz; datas identificadas podem ser revisadas antes da criação de eventos.

| Camada | Abrangência identificada |
| --- | --- |
| Captura | Cinco modos: FOTO, VÍDEO, SCAN, LIBRAS e AULA. SCAN reúne captura multipágina e opção matemática; AULA acompanha fala e gravação quando suportadas. Zoom, flash e qualidade dependem do dispositivo. |
| Organização e estudo | Matérias/pastas, biblioteca, lixeira, resumo, quiz, tradução, narração e Modo Foco. |
| Planejamento | Calendário, eventos revisados, vínculos com aulas e lembretes dependentes do ambiente. |
| Persistência e serviços | Há chamadas de API para dados e processamento; também há preferências/cache locais e cópia de mídia em IndexedDB, com envio e consulta de vídeos no backend. Não é uma arquitetura exclusivamente local. |

## 4.4 Fronteira da entrega

Incluem-se o frontend inspecionado e a especificação das melhorias de confiabilidade e experiência B01–B10. Recursos B11–B18 existem no código e exigem homologação conforme seus critérios. A revisão do documento não implementa essas melhorias. Backend, serviços de IA e dispositivos são dependências de execução; seu código, disponibilidade, segurança e desempenho não foram auditados nesta análise.


---

# 04  Requisitos e regras de negócio

Os requisitos abaixo definem o comportamento desejado do produto. Os itens propostos não devem ser apresentados como já entregues. A rastreabilidade aponta o backlog que implementa ou valida cada requisito.

| ID | Requisito funcional | Backlog |
| --- | --- | --- |
| RF01 | Capturar e revisar páginas, incluindo controles compatíveis de câmera e prévia acessível. | B04, B08, B11 |
| RF02 | Salvar rascunhos, retomar sessões e desfazer descarte de captura pendente. | B01, B02 |
| RF03 | Solicitar OCR, permitir revisão do resultado e organizar o conteúdo por matéria/pasta. | B12 |
| RF04 | Consultar biblioteca completa, pesquisar, filtrar e gerenciar lixeira/restauração. | B10, B13 |
| RF05 | Gerar resumo e quiz, traduzir e disponibilizar narração e Modo Foco. | B14 |
| RF06 | Aplicar preferências de leitura e oferecer soletração em Libras com limites explícitos. | B14, B15 |
| RF07 | Gravar/reproduzir mídia e disponibilizar transcrição quando suportada. | B16 |
| RF08 | Criar e editar eventos, revisar datas do SCAN e configurar lembretes. | B17 |
| RF09 | Interpretar expressões capturadas, permitir correção e apresentar resultado matemático. | B18 |
| RF10 | Apresentar ajuda, progresso e ações de recuperação compreensíveis. | B03, B05–B07 |

## Requisitos não funcionais — condições de aceite propostas

RNF01 — Acessibilidade: executar a jornada principal por teclado; anunciar nomes e estados aos leitores de tela; preservar foco na prévia. Verificar ampliação de texto. B03/B04/B09/B14. Não há declaração de conformidade normativa nesta revisão.

RNF02 — Responsividade e compatibilidade: validar câmera e controles nas larguras de 360 e 390 px e em desktop; documentar navegador, versão e aparelho testados; informar recursos indisponíveis. B08/B09/B11/B16.

RNF03 — Confiabilidade: recuperar rascunho após recarga, impedir confirmação falsa de salvamento e preservar páginas em falha de leitura. B01/B03/B05. RNF04 — Desempenho percebido: mostrar início do processamento antes de aguardar resposta; manter indicação de etapa e medir duração na homologação, sem prometer tempo fixo. B03/B12.

RNF05 — Tratamento de dados: explicar quando há processamento remoto, distinguir dados locais/remotos e documentar descarte. Autenticação e isolamento entre usuários precisam de definição antes da evolução B19; não se afirma proteção já homologada. RNF06 — Operação: diferenciar instalação PWA de disponibilidade offline; indicar indisponibilidade da rede nos fluxos remotos. B05/B06.

## Regras de negócio

RB01: evento sugerido exige revisão e confirmação antes de persistir. RB02: exclusão definitiva de conteúdo salvo exige confirmação. RB03: leitura e classificação automáticas são sugestões sujeitas a conferência. RB04: “salvo” depende de confirmação do destino; rascunho não equivale a conteúdo organizado. RB05: não apagar fotos da galeria do aparelho no fluxo web.


---

# 04  Entregáveis, premissas e limites

## 4.5 Entregáveis e verificação

| Entregável | Aceite e evidência esperada |
| --- | --- |
| D01 — Jornada de captura e organização | Demonstrar captura de três páginas, prévia, processamento e consulta após recarga. Registrar ambiente e resultado (B11–B13). |
| D02 — Melhoria de confiabilidade proposta | Demonstrar retomada, desfazer, progresso acessível e recuperação de erros. Guardar evidências dos cenários B01–B05 após implementação. |
| D03 — Estudo e modos complementares | Demonstrar B14–B18 em conteúdo conhecido; identificar dependências e funções indisponíveis, sem equipará-las a sucesso. |
| D04 — Documentação da Sprint 4 | Entregar as dez avaliações heurísticas, backlog com prioridade/valor/aceite e escopo com requisitos, premissas, restrições e exclusões. Este documento contempla os três critérios do enunciado; a exportação final deve corresponder a esta revisão. |
| D05 — Registro de homologação a produzir | Consolidar cenários, dispositivos, capturas de tela, resultados e defeitos. Ainda não realizado nesta revisão; necessário para afirmar validação operacional. |

## 4.6 Premissas

O estudante dispõe de aparelho com câmera e navegador compatível; concede permissões quando necessárias; usa HTTPS ou localhost no acesso à câmera. Os fluxos remotos pressupõem conectividade e backend compatível com o frontend. Materiais precisam estar suficientemente enquadrados e legíveis. O usuário confere resultados automáticos. A equipe terá acesso a dispositivos representativos para homologação.

## 4.7 Restrições e dependências

Permissões e suporte a câmera, microfone, flash, zoom, voz e notificações variam. Resolução solicitada pode diferir da efetiva. Armazenamento local tem limites e pode ser removido pelo navegador. Serviços externos têm latência, indisponibilidade e limites de uso; o documento não fixa cotas como garantia. Não foram informados orçamento, capacidade da equipe ou prazo detalhado; não se inventam compromissos de entrega.

## 4.8 Exclusões explícitas

Ficam fora da entrega comprovada: autenticação ativa, isolamento de contas homologado, sincronização garantida entre aparelhos, aplicativo nativo, remoção automática de fotos da galeria, integração com óculos e tradução de frases completas em Libras. Também não se garantem precisão universal de OCR/IA/matemática, aprendizado melhorado, entrega de notificações em qualquer condição ou funcionamento integral sem rede.

## 4.9 Gestão de mudanças

Novos recursos devem ser registrados no backlog com necessidade, valor, dependências e aceite. A equipe avalia impacto no recorte e só altera compromissos após repriorização. O escopo da próxima implementação começa pelas falhas que ameaçam a continuidade da captura; recursos futuros não devem ser apresentados como parte da versão homologada.


---

# 05  Conclusão e referências

O Jovi Insight possui, no frontend examinado, uma jornada de captura ligada a organização, serviços de estudo e calendário. A revisão corrige a descrição de uma aplicação apenas local e torna explícitos os limites de autenticação, Libras e uso offline. As melhorias prioritárias são recuperar capturas interrompidas, desfazer descartes, tornar a prévia acessível e orientar corretamente falhas de processamento.

A avaliação cobre os dez princípios solicitados, com evidências e verificações propostas. O backlog descreve necessidade, valor para usuário e negócio, prioridade, dependências e aceite. O relatório de escopo delimita o que está presente, o que é melhoria proposta e o que depende de uma evolução. A nota acadêmica e a validação operacional permanecem a cargo das avaliações correspondentes.

## Referências conceituais

[R1] NIELSEN, Jakob. 10 Usability Heuristics for User Interface Design. Nielsen Norman Group, 1994; revisão de 30 jan. 2024. Disponível em: https://www.nngroup.com/articles/ten-usability-heuristics/. Acesso em: 14 out. 2026.

[R2] NIELSEN, Jakob. Severity Ratings for Usability Problems. Nielsen Norman Group. Disponível em: https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/. Acesso em: 14 out. 2026.

## Fontes do projeto e localização das evidências

[P1] SoftwareTotalExperienceSprint4.pdf, versão original de 30 set. 2026, 6 páginas. Autoria identificada na capa: Alisson Gomes Pereira. Original preservado em docs/sprint4/SoftwareTotalExperienceSprint4.original.pdf.

[P2] README.md e package.json: funcionalidades, limites de Libras e tecnologias. app/page.tsx: modos, beforeunload, concluirAula, tira-paginas, prévia e zoom. lib/use-camera.ts: capacidades e erros de câmera. components/CameraDrawers.tsx: ajustes e qualidade efetiva.

[P3] lib/api.ts e lib/biblioteca-api.ts: chamadas remotas e contratos. app/library/page.tsx: paginação, matérias, lixeira e falhas parciais. app/login/page.tsx e components/GuardaSessao.tsx: ausência de barreira ativa de login nessa versão.

[P4] app/summary/[id]/page.tsx, components/Quiz.tsx e app/translate/page.tsx: chamadas de resumo, quiz e tradução. README.md e arquivos de câmera fundamentam o recorte dos modos complementares. lib/use-narracao.ts evidencia narração remota com fallback do navegador. lib/video-library.ts evidencia cópia local e sincronização de vídeos com backend; lib/use-aula.ts e app/page.tsx distinguem acompanhamento de fala/gravação do SCAN multipágina. Sua qualidade operacional não foi medida.

## Plano de validação posterior

Executar os cenários de aceite do backlog em aparelhos representativos, incluindo leitor de tela e teclado. Observar participantes do público-alvo tentando capturar, organizar e reencontrar material; registrar conclusão da tarefa, erros e dúvidas. Reavaliar severidades pela frequência, impacto e persistência observados. Não tratar os cenários propostos neste documento como testes já executados.
