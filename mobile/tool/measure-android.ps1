[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9:._-]+$')][string]$Serial,
    [Parameter(Mandatory)][string]$OutputPath,
    [string]$AdbPath = 'D:\Android\Sdk\platform-tools\adb.exe',
    [ValidatePattern('^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$')][string]$Package = 'com.lambe.mobile',
    [ValidateSet('profile','release','debug')][string]$BuildMode = 'profile',
    [ValidateRange(1,10)][int]$Runs = 5,
    [ValidateRange(2,30)][int]$SettleSeconds = 5,
    [string]$ApkPath
)

$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$measurementPath = [IO.Path]::GetFullPath($OutputPath)
if (-not $measurementPath.StartsWith($workspacePath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Measurement output must remain inside this workspace.'
}
function Invoke-Device([string[]]$DeviceArguments) {
    $result = & $AdbPath -s $Serial @DeviceArguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "ADB command failed: $($DeviceArguments[0])" }
    return ($result | ForEach-Object { $_.ToString() }) -join "`n"
}
function Read-Number([string]$Text, [string]$Pattern) {
    $match = [regex]::Match($Text, $Pattern)
    if ($match.Success) { return [long]$match.Groups[1].Value }
    return $null
}

$deviceState = Invoke-Device @('get-state')
if ($deviceState.Trim() -ne 'device') { throw 'Device must be connected and authorized.' }
$device = [ordered]@{
    model = (Invoke-Device @('shell','getprop','ro.product.model')).Trim()
    android = (Invoke-Device @('shell','getprop','ro.build.version.release')).Trim()
    sdk = (Invoke-Device @('shell','getprop','ro.build.version.sdk')).Trim()
    abis = (Invoke-Device @('shell','getprop','ro.product.cpu.abilist')).Trim()
    totalRamKiB = Read-Number (Invoke-Device @('shell','cat','/proc/meminfo')) 'MemTotal:\s+(\d+)'
}
$battery = Invoke-Device @('shell','dumpsys','battery')
$batteryMetadata = [ordered]@{
    usbPowered = $battery -match 'USB powered:\s+true'
    level = Read-Number $battery 'level:\s+(\d+)'
    temperatureTenthsC = Read-Number $battery 'temperature:\s+(\d+)'
}
$artifact = $null
if ($ApkPath) {
    $apk = Get-Item -LiteralPath $ApkPath
    $artifact = [ordered]@{ bytes = $apk.Length; sha256 = (Get-FileHash -LiteralPath $apk.FullName -Algorithm SHA256).Hash }
}
$samples = @()
for ($run=1; $run -le $Runs; $run++) {
    Invoke-Device @('shell','am','force-stop',$Package) | Out-Null
    $launch = Invoke-Device @('shell','am','start','-W','-n',"$Package/.MainActivity")
    if ($launch -notmatch 'Status:\s+ok') { throw 'Android launch failed; no measurement was recorded.' }
    Start-Sleep -Seconds $SettleSeconds
    $memory = Invoke-Device @('shell','dumpsys','meminfo','-s',$Package)
    $pss = Read-Number $memory 'TOTAL PSS:\s+(\d+)'
    if ($null -eq $pss) { throw 'App process is missing or memory output is unsupported.' }
    $samples += [ordered]@{
        run = $run
        androidThisTimeMs = Read-Number $launch 'ThisTime:\s+(\d+)'
        androidTotalTimeMs = Read-Number $launch 'TotalTime:\s+(\d+)'
        androidWaitTimeMs = Read-Number $launch 'WaitTime:\s+(\d+)'
        pssKiB = $pss
        javaHeapKiB = Read-Number $memory 'Java Heap:\s+(\d+)'
        nativeHeapKiB = Read-Number $memory 'Native Heap:\s+(\d+)'
        graphicsKiB = Read-Number $memory 'Graphics:\s+(\d+)'
    }
    Write-Output "Run $run/$Runs captured."
}
$measurement = [ordered]@{
    capturedAtUtc = [DateTime]::UtcNow.ToString('o')
    package = $Package; buildMode = $BuildMode; device = $device; battery = $batteryMetadata
    artifact = $artifact; settleSeconds = $SettleSeconds; samples = $samples
    scope = 'Cold process restarts; disk caches and user session preserved. Current landing screen only.'
    limitations = @('am -W measures Android Activity startup, not time to interactive.',
        'PSS is whole-process memory, not Dart heap alone.',
        'USB charging prevents battery-drain conclusions.',
        'These samples do not certify scrolling, video, maps, online idle or EN_ROUTE performance.')
}
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($measurementPath)) -Force | Out-Null
$measurement | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $measurementPath -Encoding utf8
Write-Output "Saved $measurementPath"
