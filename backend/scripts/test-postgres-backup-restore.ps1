param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^lambe_booking_test_[a-z0-9_]+$')]
  [string]$SourceDatabase
)

$ErrorActionPreference = 'Stop'
$backendRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$backupDirectory = Join-Path $env:TEMP 'lambe-backup-drills'
$runId = [guid]::NewGuid().ToString('N').Substring(0, 12)
$restoreDatabase = "lambe_booking_test_restore_$runId"
$containerBackup = "/tmp/lambe-test-backup-$runId.dump"
$hostBackup = Join-Path $backupDirectory "$SourceDatabase-$runId.dump"

function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed with exit code $LASTEXITCODE."
  }
}

Push-Location $backendRoot
try {
  New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
  $exists = & docker compose exec -T postgres psql -U postgres -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$SourceDatabase'"
  if ($LASTEXITCODE -ne 0 -or $exists.Trim() -ne '1') {
    throw "Source test database is unavailable: $SourceDatabase"
  }
  Invoke-Docker -Arguments @('compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'postgres', '-d', $SourceDatabase, '-Fc', '-f', $containerBackup)
  Invoke-Docker -Arguments @('compose', 'exec', '-T', 'postgres', 'pg_restore', '--list', $containerBackup) | Out-Null
  Invoke-Docker -Arguments @('compose', 'cp', "postgres:${containerBackup}", $hostBackup)
  if ((Get-Item -LiteralPath $hostBackup).Length -le 0) { throw 'Backup archive is empty.' }
  Invoke-Docker -Arguments @('compose', 'exec', '-T', 'postgres', 'createdb', '-U', 'postgres', $restoreDatabase)
  Invoke-Docker -Arguments @('compose', 'exec', '-T', 'postgres', 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', $restoreDatabase, $containerBackup)

  $countsQuery = 'SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ''public'' AND table_type = ''BASE TABLE''), (SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL), (SELECT COUNT(*) FROM service_orders), (SELECT COUNT(*) FROM ai_messages);'
  $sourceCounts = & docker compose exec -T postgres psql -U postgres -d $SourceDatabase -At -F ',' -c $countsQuery
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect source database.' }
  $restoredCounts = & docker compose exec -T postgres psql -U postgres -d $restoreDatabase -At -F ',' -c $countsQuery
  if ($LASTEXITCODE -ne 0 -or $sourceCounts.Trim() -ne $restoredCounts.Trim()) {
    throw 'Restored database counts do not match the source.'
  }

  [pscustomobject]@{
    backupFile = $hostBackup
    sha256 = (Get-FileHash -LiteralPath $hostBackup -Algorithm SHA256).Hash
    bytes = (Get-Item -LiteralPath $hostBackup).Length
    restoredDatabase = $restoreDatabase
    verifiedCounts = $restoredCounts.Trim()
  } | ConvertTo-Json
} finally {
  & docker compose exec -T postgres rm -f -- $containerBackup 2>$null | Out-Null
  Pop-Location
}
