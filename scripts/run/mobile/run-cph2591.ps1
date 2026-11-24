param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FlutterArgs
)

# 1. Resolve Android SDK and adb path
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCmd) {
    $sdkCandidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        "D:\Android\Sdk",
        "$env:LOCALAPPDATA\Android\Sdk",
        "C:\Android\Sdk"
    )
    foreach ($cand in $sdkCandidates) {
        if ($cand -and (Test-Path "$cand\platform-tools\adb.exe")) {
            $adbDir = "$cand\platform-tools"
            $env:PATH = "$adbDir;$env:PATH"
            Write-Host "[INFO] Added adb to PATH from: $adbDir" -ForegroundColor DarkGray
            break
        }
    }
}

# 2. Detect CPH2591 device
$targetDevice = "CPH2591"
try {
    $devicesOutput = & adb devices -l 2>$null
    foreach ($line in $devicesOutput) {
        if ($line -match '^(\S+)\s+device.*(?:model:CPH2591|device:CPH2591)') {
            $targetDevice = $matches[1]
            break
        }
    }
} catch {}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Running Lambe Mobile on OPPO (CPH2591)" -ForegroundColor Cyan
Write-Host " Device Target: $targetDevice" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# 3. Route device localhost:5000 to the actual Lambe host port.
. "$PSScriptRoot\resolve-lambe-backend.ps1"
$hostPort = Resolve-LambeApiHostPort
Write-Host "[1/3] Setting up ADB port reverse (tcp:5000 -> tcp:$hostPort)..." -ForegroundColor Yellow
& adb -s $targetDevice reverse tcp:5000 "tcp:$hostPort"
if ($LASTEXITCODE -ne 0) { throw 'ADB reverse failed; cannot connect mobile to Lambe API.' }
Write-Host "[OK] Lambe API connected through localhost:5000" -ForegroundColor Green

# 4. Resolve mobile directory
$mobileDir = $null
if (Test-Path (Join-Path (Get-Location) "pubspec.yaml")) {
    $mobileDir = (Get-Location).Path
} else {
    $candidateMobile = Join-Path $PSScriptRoot "..\..\..\mobile"
    if (Test-Path (Join-Path $candidateMobile "pubspec.yaml")) {
        $mobileDir = (Resolve-Path $candidateMobile).Path
    } else {
        $candidateRootMobile = "D:\Project\Lambe\mobile"
        if (Test-Path (Join-Path $candidateRootMobile "pubspec.yaml")) {
            $mobileDir = $candidateRootMobile
        }
    }
}

if (-not $mobileDir) {
    Write-Error "Cannot locate Flutter mobile directory (missing pubspec.yaml)."
    exit 1
}

# 5. Launch Flutter app
Push-Location $mobileDir
try {
    Write-Host "[2/3] Working directory: $mobileDir" -ForegroundColor DarkGray
    Write-Host "[3/3] Launching Flutter app on $targetDevice..." -ForegroundColor Green
    
    $runArgs = @(
        "run",
        "-d", $targetDevice,
        "--dart-define=API_BASE_URL=http://localhost:5000/api"
    )
    if ($FlutterArgs) {
        $runArgs += $FlutterArgs
    }

    Write-Host "Command: flutter $($runArgs -join ' ')" -ForegroundColor DarkGray
    & flutter @runArgs
} finally {
    Pop-Location
}
