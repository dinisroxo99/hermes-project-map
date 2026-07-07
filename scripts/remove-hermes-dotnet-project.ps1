param(
  [Parameter(Mandatory = $true)]
  [string]$Name
)

$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectsFile = Join-Path $rootDir "data\projects.json"

if (!(Test-Path $projectsFile)) {
  throw "Ficheiro data/projects.json não encontrado."
}

$projects = @(Get-Content $projectsFile -Raw | ConvertFrom-Json)

$before = $projects.Count
$projects = @($projects | Where-Object { $_.name -ne $Name })
$after = $projects.Count

ConvertTo-Json -InputObject @($projects) -Depth 10 | Out-File $projectsFile -Encoding utf8

if ($before -eq $after) {
  Write-Host "Nenhum projeto encontrado com o nome: $Name" -ForegroundColor Yellow
} else {
  Write-Host "Projeto removido: $Name" -ForegroundColor Green
}