$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$repo\local-core\server.mjs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$legacyTaskName = "JARVIS Local Core"
$taskName = "E.L.Y.S.I.A Local Core"
if (Get-ScheduledTask -TaskName $legacyTaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $legacyTaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force
Write-Host "E.L.Y.S.I.A Core configurado para iniciar com o Windows."