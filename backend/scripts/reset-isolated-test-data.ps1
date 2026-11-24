$ErrorActionPreference = 'Stop'
$composeFile = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\docker-compose.test.yml')).Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $composeFile.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test compose file must remain inside the backend directory.'
}

# The dedicated compose file stores PostgreSQL data in tmpfs. Stopping only this
# named test stack clears its synthetic fixtures without touching the app stack.
docker compose -f $composeFile down
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the isolated test stack.' }
docker compose -f $composeFile up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Could not start the isolated test stack.' }
