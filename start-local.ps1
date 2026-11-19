param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'scripts/start-local.ps1') @PSBoundParameters
