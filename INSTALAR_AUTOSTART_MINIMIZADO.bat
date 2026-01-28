@echo off
title Configurar Inicio Minimizado (Tray)
color 0B

echo =======================================================
echo    INSTALAR VERITAS NA BANDEJA DO SISTEMA (TRAY)
echo =======================================================
echo.
echo Isso criara um atalho na inicializacao do Windows.
echo O servidor ficara oculto (apenas um icone perto do relogio).
echo.

set "SCRIPT_PATH=%~dp0scripts\systray_launcher.ps1"
set "TARGET_DIR=%~dp0desktop-app"

:: Cria o atalho via PowerShell
powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\VeritasTray.lnk'); $SC.TargetPath = 'powershell.exe'; $SC.Arguments = '-ExecutionPolicy Bypass -WindowStyle Hidden -File \""%SCRIPT_PATH%\"" -TargetDir \""%TARGET_DIR%\""'; $SC.IconLocation = 'shell32.dll,1'; $SC.WindowStyle = 7; $SC.Description = 'Veritas Tray'; $SC.Save()"

if %errorlevel% equ 0 (
    echo [SUCESSO] Configurado com sucesso!
    echo.
    echo Para testar agora, vou iniciar ele para voce...
    timeout /t 3
    start "" powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT_PATH%" -TargetDir "%TARGET_DIR%"
) else (
    color 0C
    echo [ERRO] Falha ao criar atalho.
)

pause