$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { $raw = ($input | Out-String) }
    $raw = $raw.Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) { @{ cancel = $false; errorMessage = '' } | ConvertTo-Json -Compress; exit 0 }
    $payload = $raw | ConvertFrom-Json
    $name = [string]$payload.tool_call.name
    $input = $payload.tool_call.input | ConvertTo-Json -Compress -Depth 10
    $reason = ''
    $bs = [string][char]92
    $isWrite = $name -match '(?i)write|edit|replace|patch|create|append'
    $isCommand = $name -match '(?i)command|exec|run|shell'

    if ($isWrite -and $input.Contains('.env') -and -not $input.Contains('.env.example')) { $reason = 'Écriture dans un fichier .env interdite (dépôt public).' }
    if (-not $reason -and $isWrite -and ($input.Contains('prisma/migrations') -or $input.Contains('prisma'+$bs+'migrations'))) { $reason = 'Migration Prisma : arrêt obligatoire. Demander l''accord explicite avant toute modification.' }
    if (-not $reason -and $isCommand) {
        foreach ($p in 'git push --force','git push -f','git reset --hard','prisma migrate reset','prisma migrate dev','prisma db push','drop database','rm -rf','Remove-Item -Recurse') { if ($input.Contains($p)) { $reason = 'Commande destructive bloquée. Demander l''accord explicite.'; break } }
        if (-not $reason -and $input.Contains('.env') -and -not $input.Contains('.env.example') -and ($input -match '(?i)set-content|out-file|add-content|>\s*\.env')) { $reason = 'Écriture dans un fichier .env par commande interdite (dépôt public).' }
        if (-not $reason -and $input.Contains('--no-verify')) { $reason = '--no-verify est interdit sans justification documentée (AGENTS.md §4.6).' }
    }
    @{ cancel = [bool]$reason; errorMessage = $reason } | ConvertTo-Json -Compress
} catch {
    @{ cancel = $false; errorMessage = '' } | ConvertTo-Json -Compress
}