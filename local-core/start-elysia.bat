@echo off
setlocal
cd /d "%~dp0.."
where ollama >nul 2>nul
if errorlevel 1 (echo [ERRO] Ollama nao encontrado no PATH.&pause&exit /b 1)
ollama list | findstr /c:"qwen3:4b" >nul
if errorlevel 1 ollama pull qwen3:4b
node local-core\server.mjs
pause