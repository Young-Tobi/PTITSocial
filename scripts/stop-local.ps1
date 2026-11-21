. (Join-Path $PSScriptRoot 'local-common.ps1')
$localLock = Enter-LocalLock
try {
  $components = @(Get-LocalComponents)
  [array]::Reverse($components)
  $failed = @()
  foreach ($component in $components) {
    try { Stop-LocalComponent $component } catch {
      $failed += $component.Name
      Write-Warning $_.Exception.Message
    }
  }
  if ($failed.Count) { throw "Could not stop: $($failed -join ', '). Inspect $logDir" }
  Write-Host 'PTITSocial stopped. Databases, uploaded files and email history are preserved.'
} finally {
  $localLock.ReleaseMutex()
  $localLock.Dispose()
}
