function Resolve-LambeApiHostPort {
    $port = $env:LAMBE_API_HOST_PORT
    if (-not $port -and (Get-Command docker -ErrorAction SilentlyContinue)) {
        $published = @(& docker port lambe_server 5000/tcp 2>$null)
        if ($LASTEXITCODE -eq 0) {
            $match = [regex]::Match(($published -join "`n"), '(?m)^0\.0\.0\.0:(\d+)\s*$')
            if ($match.Success) { $port = $match.Groups[1].Value }
        }
    }
    if (-not $port) { $port = '5000' }
    $parsedPort = 0
    if (-not [int]::TryParse($port, [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) {
        throw 'LAMBE_API_HOST_PORT must be a valid TCP port.'
    }
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$parsedPort/api/health" -TimeoutSec 5
    } catch {
        throw "Lambe API is unavailable on host port $parsedPort. Start the backend container first."
    }
    if ($health.data.status -ne 'ok') {
        throw "Host port $parsedPort is not a healthy Lambe API."
    }
    return $parsedPort
}
