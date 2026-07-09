param(
  [Parameter(Mandatory = $true)]
  [string]$Name
)

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

function Write-ProjectRegistry($projects) {
  $items = @($projects)

  if ($items.Count -eq 0) {
    $json = "[]`n"
  } elseif ($items.Count -eq 1) {
    $json = "[`n$($items[0] | ConvertTo-Json -Depth 10)`n]`n"
  } else {
    $json = ($items | ConvertTo-Json -Depth 10) + "`n"
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($projectsFile, $json, $utf8NoBom)
}

if (!(Test-Path $projectsFile)) {
  throw "Ficheiro data/projects.json não encontrado."
}

$projects = @(Read-ProjectRegistry)
$before = $projects.Count
$projects = @($projects | Where-Object { $_.name -ne $Name })
$after = $projects.Count

Write-ProjectRegistry $projects

if ($before -eq $after) {
  Write-Host "Nenhum projeto encontrado com o nome: $Name" -ForegroundColor Yellow
} else {
  Write-Host "Projeto removido: $Name" -ForegroundColor Green
}
