# Gravação e transcrição — preparação da apresentação

## Correções

- Multipart com arquivo nomeado, MIME sem parâmetros de codec e validação de tamanho/leitura. Gravações de até 16 MiB são materializadas numa cópia antes do envio; aulas maiores não são duplicadas inteiras em RAM.
- O detalhe de erros 422 (inclusive listas de validação), 429, 503 e rede aparece no player. Não atribuir todo erro ao Gemini.
- Gravação no IndexedDB só é confirmada após o commit. Sync e edição são serializados por vídeo; nos navegadores com Web Locks, também entre abas.
- `envio_id` UUID persistido antes do upload é reutilizado em retries. O backend usa esse ID para devolver o registro já criado se a resposta anterior se perdeu. Listagem reconhece esse ID sem duplicar a cópia local.
- Transcrições locais pendentes não são sobrescritas pela listagem remota. Falha de PATCH não repete upload do arquivo.
- Player oferece baixar o original, tentar sincronizar, cancelar a espera pela transcrição e repetir quando não foi encontrada fala. Cancelar a espera não garante cancelamento da chamada já aceita pelo provedor.
- Aviso ao gravar sem microfone e proteção contra início/fim simultâneos da gravação; cabeçalho do player respeita a área da barra de status do iPhone.
- Service worker v18 atualiza assets sem apagar o IndexedDB.

## Validação

`npm test` inclui `tests/video-upload.test.cjs` e `tests/video-gravador.test.cjs` (MediaRecorder simulado). Para os testes de navegador, executar o build em `localhost:3107` e:

```
npm run test:video:player
```

Os testes aceitam `TEST_URL`, `PLAYWRIGHT_PACKAGE` e `CHROMIUM_PATH`. Usam um MP4 sintético e APIs simuladas. `ffmpeg` com encoder `libvpx-vp9` é necessário para gerar a mídia de teste. Exercitam 422, 429, silêncio, cancelamento, resposta perdida após upload, falha de PATCH, reabertura, preservação dos bytes, transações abortadas e operações concorrentes. Não certificam a câmera física nem a precisão da IA no iPhone.

## Checklist no aparelho real

1. Atualizar o app fechando e reabrindo, sem limpar seus dados. Baixar os vídeos que ainda estão pendentes como reserva.
2. Liberar câmera e microfone; gravar 10–20 segundos de fala e ouvir o arquivo antes de transcrever.
3. Transcrever, conferir os trechos e confirmar “Banco + offline”. Abrir a galeria em outro aparelho para verificar a persistência.
4. Reabrir a gravação no mesmo aparelho e conferir vídeo/transcrição. Repetir três vezes na conexão da apresentação.
5. Manter uma aula já transcrita como reserva. Se falhar, registrar o texto completo do erro, o horário, navegador e tamanho; não enviar tokens/chaves.

Não prometer transcrição de um vídeo sem som, disponibilidade contínua do Render gratuito, entrega Web Push não configurada ou ausência total de erros. Upgrade do Render é uma decisão separada e não corrige validação de upload.
