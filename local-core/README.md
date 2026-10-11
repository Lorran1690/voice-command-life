# E.L.Y.S.I.A Local Core

Este diretório executa o núcleo local da E.L.Y.S.I.A usando Ollama.

## Iniciar
Na raiz do projeto:

  node local-core/server.mjs

ou execute local-core\\start-jarvis.bat

API: http://127.0.0.1:3210
Modelo padrão: qwen3:4b
Sem chave de API.

## Iniciar com o Windows
PowerShell:

  powershell -ExecutionPolicy Bypass -File .\\local-core\\install-startup.ps1