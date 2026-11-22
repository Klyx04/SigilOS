$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $sha = (git -C $root rev-parse --short HEAD 2>$null)
    $roadmap = Join-Path $root 'docs/ROADMAP.md'
    $lines = @(Get-Content -LiteralPath $roadmap -Encoding UTF8 -ErrorAction Stop)
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match '^##\s+0\.') { $start = $i; break } }
    $next = ''
    if ($start -ge 0) {
        for ($i = $start + 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^##\s+') { break }
            if ($lines[$i] -match '^\s*-\s+(.+)$') { $next = $Matches[1]; break }
        }
    }
    if ($next) {
        $next = ($next -replace '\*\*','').Trim()
        if ($next.Length -gt 240) { $next = $next.Substring(0, 237) + '…' }
    } else { $next = '§0 « Reprise immédiate » introuvable' }
    $msg = "Reprise SigilOS — dev $sha · $next"
    @{ contextModification = $msg; cancel = $false } | ConvertTo-Json -Compress
} catch { @{ cancel = $false } | ConvertTo-Json -Compress }