# PowerShell Script para Rodar Node.js na System Tray
# Salvar em: scripts/systray_launcher.ps1

param(
    [string]$TargetDir
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Caminho do server.js
$serverScript = Join-Path $TargetDir "server.js"

if (-not (Test-Path $serverScript)) {
    [System.Windows.Forms.MessageBox]::Show("Erro: server.js nao encontrado em `n$TargetDir", "Veritas Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    exit
}

# Iniciar Processo Node Oculto
$nodeProc = Start-Process node -ArgumentList "server.js" -WorkingDirectory $TargetDir -WindowStyle Hidden -PassThru

# Configurar Tray Icon
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "Sistema Veritas (Rodando)"
$notifyIcon.Visible = $true

# Tenta usar ícone do cmd ou padrão
try {
    $notifyIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon("$env:SystemRoot\System32\cmd.exe")
} catch {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

# Menu de Contexto
$contextMenu = New-Object System.Windows.Forms.ContextMenu

# Item: Abrir Navegador
$menuItemOpen = New-Object System.Windows.Forms.MenuItem "Abrir Painel Web"
$menuItemOpen.add_Click({
    Start-Process "http://localhost:3000"
})

# Item: Sair
$menuItemExit = New-Object System.Windows.Forms.MenuItem "Parar Servidor e Sair"
$menuItemExit.add_Click({
    $notifyIcon.Visible = $false
    if (-not $nodeProc.HasExited) {
        Stop-Process -Id $nodeProc.Id -Force
    }
    [System.Windows.Forms.Application]::Exit()
})

$contextMenu.MenuItems.Add($menuItemOpen) | Out-Null
$contextMenu.MenuItems.Add("-") | Out-Null
$contextMenu.MenuItems.Add($menuItemExit) | Out-Null

$notifyIcon.ContextMenu = $contextMenu

# Balão de Notificação Inicial
$notifyIcon.ShowBalloonTip(3000, "Veritas Iniciado", "O servidor esta ativo na bandeja do sistema.", [System.Windows.Forms.ToolTipIcon]::Info)

# Loop da Aplicação (Mantém o script rodando)
[System.Windows.Forms.Application]::Run()
