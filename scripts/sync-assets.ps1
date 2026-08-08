# =============================================================================
# SigilOS - Script de Synchronisation des Assets pour PowerShell (Windows)
# =============================================================================
# Usage: .\scripts\sync-assets.ps1 beta|prod [subfolder] [-DryRun]
# Exemple: .\scripts\sync-assets.ps1 beta w38
# =============================================================================

param (
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("beta", "prod")]
    [string]$Target,

    [Parameter(Position=1)]
    [string]$SubFolder = "",

    [Parameter(Position=2)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

# Charger .env.local si present
$EnvLocal = "$ProjectRoot\.env.local"
if (Test-Path $EnvLocal) {
    Get-Content $EnvLocal | ForEach-Object {
        if ($_ -match '^(VPS_[A-Z_]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$VpsAlias = if ($Target -eq "beta") { $env:VPS_SSH_ALIAS_BETA } else { $env:VPS_SSH_ALIAS_PROD }
$VpsPath  = if ($Target -eq "beta") { $env:VPS_PATH_BETA } else { $env:VPS_PATH_PROD }

if (-not $VpsAlias) {
    Write-Error "Ni VPS_SSH_ALIAS_BETA ni VPS_SSH_ALIAS_PROD n'est defini dans .env.local."
}
if (-not $VpsPath) {
    Write-Error "VPS_PATH non defini dans .env.local."
}

# Gestion du sous-dossier specifique (ex: w38)
$LocalPath = "./public/game-data/"
$RemotePath = "$VpsPath/public/game-data/"

if ($SubFolder -eq "w38" -or $SubFolder -match '^w\d+$') {
    $LocalPath = "./public/game-data/tiles/$SubFolder/"
    $RemotePath = "$VpsPath/public/game-data/tiles/$SubFolder/"
    Write-Host "🎯 Mode Cible Specifique : $SubFolder" -ForegroundColor Yellow
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   SYNCHRONISATION DES ASSETS -> $Target (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Hote Distant : $VpsAlias"
Write-Host "   Chemin Cible : $RemotePath`n"

if ($Target -eq "prod" -and -not $DryRun) {
    $Confirm = Read-Host "DANGER : Ecraser les images de PRODUCTION ? (Saisir OUI pour confirmer)"
    if ($Confirm -ne "OUI") {
        Write-Host "Annule." -ForegroundColor Yellow
        exit
    }
}

# Si WSL est disponible, utiliser rsync via WSL pour la rapidite
$wslCmd = Get-Command wsl -ErrorAction SilentlyContinue
if ($wslCmd) {
    Write-Host "Synchronisation rapide via rsync (WSL)..." -ForegroundColor Green
    $dryFlag = if ($DryRun) { "--dry-run" } else { "" }
    wsl rsync -avzc --progress --human-readable $dryFlag "$LocalPath" "$VpsAlias`:$RemotePath"
} else {
    Write-Host "Synchronisation via SCP (PowerShell)..." -ForegroundColor Green
    if ($DryRun) {
        Write-Host "Mode Dry-Run : Simulation SCP." -ForegroundColor Yellow
    } else {
        scp -r "$LocalPath*" "$VpsAlias`:$RemotePath"
    }
}

Write-Host "`nTransfert termine avec succes !" -ForegroundColor Green
