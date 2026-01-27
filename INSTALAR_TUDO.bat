@echo off
cd /d "%~dp0"
color 0A
echo =======================================================
echo      INSTALADOR DO VERITAS DESKTOP (NPJ)
echo =======================================================
echo.
echo Este script vai preparar tudo para voce.
echo Isso pode levar alguns minutos.
echo.
echo [1/3] Verificando pasta do projeto...

if not exist "desktop-app" (
    color 0C
    echo [ERRO] Pasta 'desktop-app' nao encontrada!
    echo Certifique-se de que extraiu todos os arquivos do zip.
    echo O arquivo bat deve estar ao lado da pasta desktop-app.
    pause
    exit /b
)

cd desktop-app

echo [2/3] Instalando dependencias do Node.js (Servidor)...
call npm install --legacy-peer-deps
call npm install apache-arrow@18.1.0
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] Falha ao instalar Node.js.
    echo Verifique se voce instalou o Node.js no computador.
    echo Site: nodejs.org
    pause
    exit /b
)

echo [3/3] Instalando dependencias do Python (IA de Documentos)...
echo Baixando bibliotecas de IA (Docling). Aguarde...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] Python nao encontrado!
    echo Instale o Python 3.10 ou superior e marque "Add to PATH".
    echo Site: python.org
    pause
    exit /b
)

python -m pip install docling langchain-text-splitters langchain-community pypdf
if %errorlevel% neq 0 (
    echo [AVISO] Falha ao instalar no Python padrao. Tentando comando alternativo...
    pip3 install docling langchain-text-splitters langchain-community pypdf
)

echo.
echo =======================================================
echo      SUCESSO! INSTALACAO CONCLUIDA.
echo =======================================================
echo Agora voce pode usar o arquivo 'INICIAR_VERITAS' para abrir.
echo.
pause
