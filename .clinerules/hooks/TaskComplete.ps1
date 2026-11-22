$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $status = @(git -C $root status --short 2>$null)
    if ($status.Count -eq 0) { $msg = 'DoD : arbre propre. Vérifier test:run, tsc et lint avant la PR.' } else {
        $liste = ($status | Select-Object -First 5) -join ' · '
        if ($status.Count -gt 5) { $liste = "$liste · …" }
        $msg = "DoD : $($status.Count) fichier(s) modifié(s) ou non suivi(s) : $liste. Vérifier les artefacts de la tâche."
    }
    @{ contextModification = $msg; cancel = $false } | ConvertTo-Json -Compress
} catch { @{ cancel = $false } | ConvertTo-Json -Compress }