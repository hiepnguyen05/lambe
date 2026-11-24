$ErrorActionPreference = 'Stop'
$dataDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'routing-data'
$extractPath = Join-Path $dataDirectory 'vietnam-latest.osm.pbf'
$graphPath = Join-Path $dataDirectory 'vietnam-latest.osrm.cells'
$image = 'ghcr.io/project-osrm/osrm-backend:v5.27.1'

if (Test-Path -LiteralPath $graphPath) {
  throw 'OSRM graph already exists. Preserve it or move it aside before preparing a new version.'
}

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $extractPath)) {
  Write-Host 'Downloading Vietnam OSM extract from Geofabrik (approximately 315 MB)...'
  Invoke-WebRequest 'https://download.geofabrik.de/asia/vietnam-latest.osm.pbf' -OutFile $extractPath
}

foreach ($step in @(
  @('osrm-extract', '-p', '/opt/car.lua', '/data/vietnam-latest.osm.pbf'),
  @('osrm-partition', '/data/vietnam-latest.osrm'),
  @('osrm-customize', '/data/vietnam-latest.osrm')
)) {
  Write-Host "Running $($step[0])..."
  & docker run --rm -v "${dataDirectory}:/data" $image @step
  if ($LASTEXITCODE -ne 0) { throw "$($step[0]) failed with exit code $LASTEXITCODE" }
}

Write-Host 'OSRM data is ready. Start with: docker compose --profile routing up -d --build'
