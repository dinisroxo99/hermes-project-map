$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectsFile = Join-Path $rootDir "data\projects.json"

if (!(Test-Path $projectsFile)) {
  Write-Host "Ainda não existem projetos."
  exit 0
}

$projects = @(Get-Content $projectsFile -Raw | ConvertFrom-Json)

if ($projects.Count -eq 0) {
  Write-Host "Ainda não existem projetos."
  exit 0
}

$projects | Format-Table name, relativePath, addedAt