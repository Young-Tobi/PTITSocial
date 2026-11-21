$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot '.local-logs'
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$runtimeScript = Join-Path $PSScriptRoot 'local-runtime.cjs'

function Enter-LocalLock {
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '')
  } finally { $hasher.Dispose() }
  $mutex = New-Object System.Threading.Mutex($false, ('Local\PTITSocial-' + $hash))
  try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
  if (-not $acquired) {
    $mutex.Dispose()
    throw 'Another start/stop operation is in progress. Wait for it to finish.'
  }
  return $mutex
}

function Get-LocalComponents {
  $configJson = & $nodeExe $runtimeScript config
  if ($LASTEXITCODE -ne 0) { throw 'Could not read local configuration. No .env files were changed.' }
  $script:localConfig = $configJson | ConvertFrom-Json
  $mongoExe = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.local-tools/mongodb') -Filter mongod.exe -File -Recurse | Sort-Object FullName | Select-Object -First 1
  if (-not $mongoExe) { throw 'MongoDB was not found in .local-tools/mongodb.' }
  $databasePath = Join-Path $projectRoot '.local-tools/mongo-data'
  $mailDatabase = Join-Path $projectRoot '.local-tools/mailpit-data/mailpit.db'
  @{
    Name='mongo'; Exe=$mongoExe.FullName; Directory=$projectRoot; Marker=$databasePath
    Ports=@($localConfig.ports.mongo)
    Arguments=@('--dbpath', $databasePath, '--bind_ip', '127.0.0.1', '--port', "$($localConfig.ports.mongo)", '--logpath', (Join-Path $logDir 'mongod.log'), '--logappend')
  }
  @{
    Name='mailpit'; Exe=(Join-Path $projectRoot '.local-tools/mailpit/mailpit.exe'); Directory=$projectRoot; Marker=$mailDatabase
    Ports=@($localConfig.ports.smtp, $localConfig.ports.mailpit)
    Arguments=@('--database', $mailDatabase, '--max', '0', '--smtp', "127.0.0.1:$($localConfig.ports.smtp)", '--listen', "127.0.0.1:$($localConfig.ports.mailpit)", '--disable-version-check')
  }
  foreach ($name in @('accounts', 'content', 'messaging', 'gateway', 'frontend')) {
    $directory = if ($name -eq 'frontend') { Join-Path $projectRoot 'apps/web' } else { Join-Path $projectRoot ('services/' + $name) }
    $entry = if ($name -eq 'frontend') { Join-Path $directory 'node_modules/react-scripts/bin/react-scripts.js' } else { Join-Path $directory 'src/server.js' }
    $arguments = @($entry)
    if ($name -eq 'frontend') { $arguments += 'start' }
    @{Name=$name; Exe=$nodeExe; Directory=$directory; Marker=$entry; Ports=@($localConfig.ports.$name); Arguments=$arguments}
  }
}

function Test-LocalProcess($component, $candidate) {
  return ($null -ne $candidate -and
    $candidate.ExecutablePath -eq $component.Exe -and
    $candidate.CommandLine -and
    $candidate.CommandLine.IndexOf($component.Marker, [StringComparison]::OrdinalIgnoreCase) -ge 0)
}

function Find-LocalProcessOwner($component, $candidate) {
  # CRA opens its listening socket in a child Node process. Keep tracking its launcher.
  for ($depth = 0; $candidate -and $depth -lt 16; $depth++) {
    if (Test-LocalProcess $component $candidate) { return $candidate }
    if (-not $candidate.ParentProcessId) { break }
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($candidate.ParentProcessId)" -ErrorAction SilentlyContinue
    if (-not $parent -or $parent.CreationDate -gt $candidate.CreationDate) { break }
    $candidate = $parent
  }
  return $null
}

function Get-LocalProcess($component) {
  $recordPath = Join-Path $logDir ($component.Name + '.process.json')
  if (-not (Test-Path -LiteralPath $recordPath)) { return $null }
  $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
  $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$record.processId)" -ErrorAction SilentlyContinue
  if ((Test-LocalProcess $component $candidate) -and $candidate.CreationDate.ToUniversalTime().Ticks.ToString() -eq $record.createdTicks) { return $candidate }
  return $null
}

function Save-LocalProcess($component, $candidate) {
  @{
    processId=$candidate.ProcessId
    createdTicks=$candidate.CreationDate.ToUniversalTime().Ticks.ToString()
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDir ($component.Name + '.process.json')) -Encoding UTF8
}

function Stop-LocalComponent($component) {
  $candidate = Get-LocalProcess $component
  if ($candidate) {
    if ($component.Name -eq 'mongo') {
      $mongoListener = Get-NetTCPConnection -LocalPort $component.Ports[0] -State Listen -ErrorAction SilentlyContinue
      if (-not ($mongoListener | Where-Object { $_.OwningProcess -eq $candidate.ProcessId })) {
        throw 'MongoDB is not listening on its expected port. It was left running to protect its data.'
      }
      & $nodeExe $runtimeScript shutdown-mongo
      if ($LASTEXITCODE -ne 0) { throw 'MongoDB shutdown failed. Check .local-logs/mongod.log.' }
    } elseif ($component.Exe -eq $nodeExe) {
      & taskkill.exe /PID $candidate.ProcessId /T /F | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Could not stop $($component.Name)." }
    } else {
      Stop-Process -Id $candidate.ProcessId -ErrorAction Stop
    }
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    if (Get-LocalProcess $component) { throw "$($component.Name) has not stopped yet." }
    Write-Host "Stopped $($component.Name)."
  }
  $recordPath = Join-Path $logDir ($component.Name + '.process.json')
  if (Test-Path -LiteralPath $recordPath) { Remove-Item -LiteralPath $recordPath }
}
