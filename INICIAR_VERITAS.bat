@echo off
cd /d "%~dp0"
title Servidor Veritas - NPJ
color 0B

echo =======================================================
echo           INICIANDO VERITAS DESKTOP...
echo =======================================================
echo.

if not exist "desktop-app" (
    color 0C
    echo [ERRO] Pasta 'desktop-app' nao encontrada!
    pause
    exit /b
)

cd desktop-app

echo [INFO] Iniciando servidor Node.js...
echo [INFO] Se a janela parecer travada, APERTE ENTER.
echo [INFO] (Isso acontece se voce clicar dentro da janela preta)
echo.

node server.js

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERRO FATAL] O servidor fechou com erro.
    echo Verifique se voce rodou o 'INSTALAR_TUDO' antes.
    pause
)
pause
