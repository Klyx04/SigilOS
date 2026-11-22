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
    $path = [string]$payload.tool_call.input.path
    if (-not $path -and $payload.tool_call.input.file_path) { $path = [string]$payload.tool_call.input.file_path }
    $reason = ''
    $bs = [string][char]92
    $isWrite = $name -match '(?i)write|edit|replace|patch|create|append'
    $isCommand = $name -match '(?i)command|exec|run|shell'

    if ($isWrite -and $path -match '(?i)(^|[\\/])\.env($|\.)' -and $path -notmatch '(?i)\.env\.example$') { $reason = 'Écriture dans un fichier .env interdite (dépôt public).' }
    if (-not $reason -and $isWrite -and ($path.Contains('prisma/migrations') -or $path.Contains('prisma'+$bs+'migrations'))) { $reason = 'Migration Prisma : arrêt obligatoire. Demander l''accord explicite avant toute modification.' }
    if (-not $reason -and $isCommand) {
        $commandPatterns = @(
            'git\s+push\s+(--force|-f)\b',
            'git\s+reset\s+--hard\b',
            'prisma\s+migrate\s+reset\b',
            'prisma\s+migrate\s+dev\b',
            'prisma\s+db\s+push\b',
            'drop\s+database\b',
            'rm\s+-rf\b',
            'remove-item\b[^|;]*\s-recurse\b'
        )
        foreach ($p in $commandPatterns) {
            if ($input -match "(?i)$p") { $reason = 'Commande destructive bloquée. Demander l''accord explicite.'; break }
        }
        if (-not $reason -and $input -match '(?i)((set-content|out-file|add-content)\s+[^\s]*\.env\b|>\s*[^\s]*\.env\b)' -and $input -notmatch '(?i)\.env\.example\b') { $reason = 'Écriture dans un fichier .env par commande interdite (dépôt public).' }
        if (-not $reason -and $input -match '(?i)--no-verify\b') { $reason = '--no-verify est interdit sans justification documentée (AGENTS.md §4.6).' }
    }
    @{ cancel = [bool]$reason; errorMessage = $reason } | ConvertTo-Json -Compress
} catch {
    @{ cancel = $true; errorMessage = 'PreToolUse : payload illisible — action bloquée par sécurité.' } | ConvertTo-Json -Compress
}