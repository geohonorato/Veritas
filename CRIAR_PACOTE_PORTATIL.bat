@echo off
cd /d "%~dp0"
echo =======================================================
echo    PREPARAR AMBIENTE PORTATIL (OFFLINE)
echo =======================================================
echo Este script cria a pasta 'python_portable' e instala as dependencias nela.
echo Voce deve executar este script em um computador com INTERNET LIVRE.
echo Depois, pode copiar a pasta do projeto inteira para o computador offline.
echo.

if not exist "python_portable" (
    mkdir python_portable
    mkdir python_portable\Lib\site-packages
)

echo [1/2] Instalando bibliotecas na pasta local...
echo Isso pode demorar e requer internet.
echo.

:: Instalando versoes especificas para evitar conflitos conhecidos com datasets
python -m pip install --target=python_portable/Lib/site-packages "dill<0.4.1" "multiprocess<0.70.19" "fsspec<=2025.10.0"

:: Instalando pacotes principais
python -m pip install --target=python_portable/Lib/site-packages docling langchain-text-splitters langchain-community pypdf sentence_transformers

if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] Falha ao baixar pacotes. Verifique sua conexao ou proxy.
    echo Tente: pip install --proxy http://user:pass@proxy:port ...
    pause
    exit /b
)

echo.
echo [2/3] Baixando Modelos de IA para cache local...
echo O script vai iniciar o gerenciador apenas para baixar os modelos.
echo Aguarde ate aparecer "Servidor RAG pronto" ou similar, e entao feche.
echo.

:: Define variavel para o script saber onde salvar se usar cache default, 
:: mas o nosso script ja define path relativo.
python scripts/rag_manager.py download_only

echo.
echo [3/3] Criando arquivo ZIP pronto para envio...
echo Compactando arquivos do projeto + python_portable...
echo Isso pode demorar alguns minutos.

powershell -Command "Compress-Archive -Path 'desktop-app', 'scripts', 'python_portable', 'INSTALAR_TUDO.bat', 'INICIAR_VERITAS.bat', 'README.md' -DestinationPath 'VERITAS_OFFLINE_INSTALLER.zip' -Force"

echo.
echo =======================================================
echo      SUCESSO! PACOTE COMPLETO CRIADO.
echo =======================================================
echo O arquivo 'VERITAS_OFFLINE_INSTALLER.zip' foi gerado.
echo Ele ja contem:
echo  - O sistema (desktop-app)
echo  - O python configurado com as libs (python_portable)
echo  - Os modelos de IA baixados
echo.
echo Basta enviar esse ZIP para o outro computador, extrair e rodar INSTALAR_TUDO.bat
echo.
pause
