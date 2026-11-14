# Keeps Windows from idle-sleeping while a long import runs. Changes no power settings: the request
# ends when this script stops (Ctrl+C, closing it, or Stop-Process). A closed lid still sleeps.
#   powershell -File scripts\keep-awake.ps1 -WatchPid 1234
# Stops by itself when process 1234 exits, or after 72 hours.
param([Parameter(Mandatory = $true)][int]$WatchPid)
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]"0x80000000"
$ES_SYSTEM_REQUIRED = [uint32]"0x00000001"
$deadline = (Get-Date).AddHours(72)
Write-Host "Keeping this PC awake while process $WatchPid runs."
try {
    while ((Get-Date) -lt $deadline -and (Get-Process -Id $WatchPid -ErrorAction SilentlyContinue)) {
        [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
        Write-Host ("{0:HH:mm}  process {1} still running" -f (Get-Date), $WatchPid)
        Start-Sleep -Seconds 300
    }
    Write-Host ("{0:HH:mm}  process {1} has ended; letting the PC sleep again." -f (Get-Date), $WatchPid)
} finally {
    [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
}
