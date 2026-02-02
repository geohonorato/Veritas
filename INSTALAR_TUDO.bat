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
echo [1/4] Verificando pasta do projeto...

if not exist "desktop-app" (
    color 0C
    echo [ERRO] Pasta 'desktop-app' nao encontrada!
    echo Certifique-se de que extraiu todos os arquivos do zip.
    echo O arquivo bat deve estar ao lado da pasta desktop-app.
    pause
    exit /b
)

cd desktop-app

echo [2/4] Instalando dependencias do Node.js (Servidor)...
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

echo [3/4] Instalando dependencias do Python (IA de Documentos)...

if exist "python_portable\python.exe" (
    echo [INFO] Python Portatil detectado em 'python_portable'.
    echo Pulando instalacao via PIP e usando ambiente local.
) else (
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

    python -m pip install agno docling langchain-text-splitters pypdf sentence-transformers openpyxl
    if %errorlevel% neq 0 (
        echo [AVISO] Falha ao instalar no Python padrao. Tentando comando alternativo...
        pip3 install agno docling langchain-text-splitters pypdf sentence-transformers openpyxl
    )
)

cd ..

echo [4/5] Criando arquivo de configuracao (.env)...
if not exist "desktop-app\.env" (
    if exist "desktop-app\.env.example" (
        copy "desktop-app\.env.example" "desktop-app\.env" >nul
        echo [INFO] .env criado. IMPORTANTE: Edite desktop-app\.env com suas chaves de API!
    ) else (
        echo [AVISO] .env.example nao encontrado.
    )
) else (
    echo [INFO] .env ja existe.
)

echo [5/5] Configurando Inicializacao Automatica (Tray)...
set "SCRIPT_PATH=%~dp0scripts\systray_launcher.ps1"
set "TARGET_DIR=%~dp0desktop-app"

powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\VeritasTray.lnk'); $SC.TargetPath = 'powershell.exe'; $SC.Arguments = '-ExecutionPolicy Bypass -WindowStyle Hidden -File \""%SCRIPT_PATH%\"" -TargetDir \""%TARGET_DIR%\""'; $SC.IconLocation = 'shell32.dll,1'; $SC.WindowStyle = 7; $SC.Description = 'Veritas Tray'; $SC.Save()"

echo.
echo =======================================================
echo      SUCESSO! INSTALACAO CONCLUIDA.
echo =======================================================
echo O sistema foi configurado e iniciara minimizado na bandeja.
echo.
start "" powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT_PATH%" -TargetDir "%TARGET_DIR%"
pause

