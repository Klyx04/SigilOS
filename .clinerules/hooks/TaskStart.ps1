$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $sha = (git -C $root rev-parse --short HEAD 2>$null)
    $roadmap = Join-Path $root 'docs\ROADMAP.md'
    $next = (Get-Content -LiteralPath $roadmap -TotalCount 20 -Encoding UTF8 -ErrorAction Stop | Where-Object { $_ -match 'Prochaine étape' } | Select-Object -First 1)
    if ($next) { $next = ($next -replace '\*\*','' -replace '^- ','').Trim() }
    $msg = if ($next) { "Reprise SigilOS — dev $sha · $next" } else { "Reprise SigilOS — dev $sha" }
    @{ contextModification = $msg; cancel = $false } | ConvertTo-Json -Compress
} catch { @{ cancel = $false } | ConvertTo-Json -Compress }