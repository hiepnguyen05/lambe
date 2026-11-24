param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)
& "$PSScriptRoot\..\scripts\run\mobile\run-rmx3261.ps1" @RemainingArgs
