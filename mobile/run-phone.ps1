param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)
& "$PSScriptRoot\..\scripts\run\mobile\run-cph2591.ps1" @RemainingArgs
