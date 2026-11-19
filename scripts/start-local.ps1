param([switch]$NoBrowser)
. (Join-Path $PSScriptRoot 'local-common.ps1')
$localLock = Enter-LocalLock
$started = @()
$previousPort = $env:PORT
$previousBrowser = $env:BROWSER
$previousHost = $env:HOST
try {
  $components = @(Get-LocalComponents)
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  # Check every port before starting anything. Never stop an unrelated process.
  foreach ($component in $components) {
    foreach ($requiredPath in @($component.Exe, $component.Marker)) {
      if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Missing $requiredPath. Restore local tools/data or install dependencies first." }
    }
    foreach ($listener in @($listeners | Where-Object { $_.LocalPort -in $component.Ports })) {
      $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
      $owner = Find-LocalProcessOwner $component $candidate
      if (-not $owner) { throw "Port $($listener.LocalPort) is occupied by another application. No process was stopped." }
      Save-LocalProcess $component $owner
    }
  }
  foreach ($component in $components) {
    if (Get-LocalProcess $component) {
      Write-Host "$($component.Name) is already running."
      continue
    }
    $env:PORT = "$($component.Ports[0])"
    $env:BROWSER = 'none'
    $env:HOST = 'localhost'
    $arguments = ($component.Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $ownedProcess = Start-Process -FilePath $component.Exe -ArgumentList $arguments -WorkingDirectory $component.Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir ($component.Name + '.log')) -RedirectStandardError (Join-Path $logDir ($component.Name + '-error.log')) -PassThru
    $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$($ownedProcess.Id)"
    if (-not (Test-LocalProcess $component $candidate)) { throw "$($component.Name) exited during startup. Inspect $logDir" }
    Save-LocalProcess $component $candidate
    $started += $component
    Write-Host "Started $($component.Name)."
    if ($component.Name -eq 'mongo') {
      $mongoDeadline = (Get-Date).AddSeconds(20)
      do {
        $mongoListener = Get-NetTCPConnection -LocalPort $component.Ports[0] -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $candidate.ProcessId }
        if ($mongoListener) { break }
        if (-not (Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue)) { throw 'MongoDB exited during startup. Check .local-logs/mongod.log.' }
        Start-Sleep -Milliseconds 500
      } while ((Get-Date) -lt $mongoDeadline)
      if (-not $mongoListener) { throw 'MongoDB startup timed out. Check .local-logs/mongod.log.' }
    }
  }
  Write-Host 'Waiting for the backend and frontend to be ready...'
  $deadline = (Get-Date).AddSeconds(120)
  $ready = $false
  do {
    foreach ($component in $components) {
      if (-not (Get-LocalProcess $component)) { throw "$($component.Name) exited. Inspect $logDir" }
    }
    try {
      $health = Invoke-RestMethod ($localConfig.gatewayUrl + '/health') -TimeoutSec 3
      $web = Invoke-WebRequest $localConfig.webUrl -UseBasicParsing -TimeoutSec 3
      $mail = Invoke-WebRequest $localConfig.mailUrl -UseBasicParsing -TimeoutSec 3
      if ($health.status -eq 'ok' -and $web.StatusCode -eq 200 -and $mail.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  if (-not $ready) { throw "Startup timed out. Inspect $logDir" }
  Write-Host "PTITSocial: $($localConfig.webUrl)"
  Write-Host "Academic Q&A: $($localConfig.webUrl)/questions"
  Write-Host "Study documents: $($localConfig.webUrl)/documents"
  Write-Host "Gateway health: $($localConfig.gatewayUrl)/health"
  Write-Host "Local email: $($localConfig.mailUrl)"
  Write-Host 'To stop: npm.cmd run stop'
  if (-not $NoBrowser) {
    try { Start-Process $localConfig.webUrl } catch { Write-Warning "Open $($localConfig.webUrl) in your browser." }
  }
} catch {
  $startupError = $_
  [array]::Reverse($started)
  foreach ($component in $started) {
    try { Stop-LocalComponent $component } catch { Write-Warning $_.Exception.Message }
  }
  throw $startupError
} finally {
  $env:PORT = $previousPort
  $env:BROWSER = $previousBrowser
  $env:HOST = $previousHost
  $localLock.ReleaseMutex()
  $localLock.Dispose()
}
