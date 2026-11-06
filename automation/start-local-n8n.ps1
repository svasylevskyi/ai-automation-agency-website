# Test-only n8n on Windows; the website can remain on Hetzner. No Docker needed.
$ErrorActionPreference = 'Stop'
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(22|24)\.') {
    throw 'Install Node.js 24 LTS, reopen PowerShell, and try again.'
}
$profilePath = Join-Path $env:LOCALAPPDATA 'AgencyProspectN8n'
New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
$env:N8N_USER_FOLDER = $profilePath
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:N8N_HOST = 'localhost'
$env:N8N_PORT = '5678'
$env:N8N_PROTOCOL = 'http'
$env:N8N_SECURE_COOKIE = 'false'
$env:GENERIC_TIMEZONE = 'Europe/Warsaw'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_RUNNERS_MODE = 'internal'
$env:EXECUTIONS_TIMEOUT = '60'
$env:EXECUTIONS_DATA_SAVE_ON_SUCCESS = 'none'
$env:EXECUTIONS_DATA_SAVE_ON_ERROR = 'none'
$env:EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS = 'false'
$env:EXECUTIONS_DATA_SAVE_ON_PROGRESS = 'false'
$env:EXECUTIONS_DATA_PRUNE = 'true'
$env:EXECUTIONS_DATA_MAX_AGE = '24'
Write-Host 'Starting the local test worker at http://localhost:5678'
Write-Host "Local profile: $profilePath (contains credentials; keep it private)."
Write-Host 'Leave this terminal open. Press Ctrl+C to stop; queued enquiries remain on the website.'
& npx.cmd --yes n8n@2.46.6 start
if ($LASTEXITCODE -ne 0) { throw "n8n stopped with exit code $LASTEXITCODE" }
