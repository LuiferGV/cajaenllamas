@echo off
setlocal

node --version >nul 2>nul
if %errorlevel%==0 (
  node %*
  exit /b %errorlevel%
)

set "BUNDLED_NODE=C:\Users\luife\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" %*
  exit /b %errorlevel%
)

echo Node.js no esta disponible. Instala Node globalmente o ajusta tools\run-node.cmd. 1>&2
exit /b 1
