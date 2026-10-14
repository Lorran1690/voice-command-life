# E.L.Y.S.I.A Local Core

Este diretório executa o núcleo local da E.L.Y.S.I.A usando Ollama.

## Iniciar
Na raiz do projeto:

  node local-core/server.mjs

ou execute local-core\\start-elysia.bat

API: http://127.0.0.1:3210
Modelo padrão: qwen3:4b
Sem chave de API.

## Iniciar com o Windows
PowerShell:

  powershell -ExecutionPolicy Bypass -File .\\local-core\\install-startup.ps1

## Voz neural feminina em português brasileiro (opcional)

A E.L.Y.S.I.A aceita a voz **E.L.Y.S.I.A Neural · Dora** (`pf_dora`), gerada
localmente por um servidor KokoroTTS. O núcleo local continua usando as vozes
do Windows quando o servidor neural não está disponível. A primeira instalação
do servidor/modelo requer download; depois, a síntese roda no próprio PC.

### Primeira instalação para teste (Windows)

1. Instale e inicie o Docker Desktop, caso deseje usar o protótipo com contêiner.
   O Docker usa memória adicional; teste primeiro a versão CPU em seu computador.
2. Abra PowerShell na pasta do projeto e execute:

```powershell
docker run -d --name elysia-kokoro -p 127.0.0.1:7860:7860 -v kokorotts_data:/app/persistent hangrylabs/kokorotts:v1.0
```

3. Espere o servidor ficar pronto. Para consultar:

```powershell
Invoke-WebRequest http://127.0.0.1:7860/health/ready
```

4. Inicie normalmente o E.L.Y.S.I.A Core (`npm.cmd run elysia:local`)
   e abra as configurações de voz do aplicativo. Selecione **E.L.Y.S.I.A
   Neural · Dora** e use **Ouvir amostra da voz**. A lista de vozes é atualizada
   ao abrir as configurações; se já estavam abertas, reabra-as.

Comandos úteis:

```powershell
docker stop elysia-kokoro
docker start elysia-kokoro
```

A URL padrão é `http://127.0.0.1:7860`. Para usar outra porta em loopback,
defina `ELYSIA_KOKORO_URL` antes de iniciar `npm.cmd run elysia:local`.
Por segurança, URLs remotas são rejeitadas.

**Importante:** este é um adaptador opcional para um serviço de voz separado,
não um empacotamento final do modelo no instalador Tauri. A execução e a
qualidade da Dora ainda precisam ser avaliadas no hardware Windows de destino.

Documentação do servidor: https://github.com/hangry-labs/kokoroTTS
