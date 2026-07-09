$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectsFile = Join-Path $rootDir "data\projects.json"

function Read-ProjectRegistry {
  if (!(Test-Path $projectsFile)) {
    return @()
  }

  $raw = Get-Content $projectsFile -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @()
  }

  $parsed = $raw | ConvertFrom-Json
  if ($null -eq $parsed) {
    return @()
  }

  return @($parsed | Where-Object {
    $_.PSObject.Properties.Name -contains "name" -and
    $_.PSObject.Properties.Name -contains "relativePath" -and
    -not [string]::IsNullOrWhiteSpace($_.name) -and
    -not [string]::IsNullOrWhiteSpace($_.relativePath)
  })
}

$projects = @(Read-ProjectRegistry)

if ($projects.Count -eq 0) {
  Write-Host "Ainda não existem projetos."
  exit 0
}

$projects | Format-Table name, relativePath, addedAt
