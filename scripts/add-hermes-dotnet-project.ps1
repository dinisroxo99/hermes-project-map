param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $rootDir ".env"
$projectsFile = Join-Path $rootDir "data\projects.json"

if (!(Test-Path $envFile)) {
  throw "Ficheiro .env não encontrado. Faz primeiro: copy .env.example .env"
}

$envLines = Get-Content $envFile
$projectsRootLine = $envLines | Where-Object { $_ -match "^PROJECTS_ROOT=" } | Select-Object -First 1

if (!$projectsRootLine) {
  throw "PROJECTS_ROOT não existe no .env"
}

$projectsRoot = $projectsRootLine.Split("=", 2)[1].Trim().Trim('"')
$projectsRootResolved = (Resolve-Path $projectsRoot).Path
$projectResolved = (Resolve-Path $Path).Path

if (!$projectResolved.StartsWith($projectsRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "O projeto tem de estar dentro de PROJECTS_ROOT. PROJECTS_ROOT atual: $projectsRootResolved"
}

if ($Name -notmatch "^[a-zA-Z0-9][a-zA-Z0-9\-_]*$") {
  throw "Nome inválido. Usa apenas letras, números, '-' ou '_'. Exemplo: faturas-backend"
}

$relativePath = $projectResolved.Substring($projectsRootResolved.Length).TrimStart("\", "/")
$relativePath = $relativePath -replace "\\", "/"

if (!(Test-Path $projectsFile)) {
  "[]" | Out-File $projectsFile -Encoding utf8
}

$projects = @(Get-Content $projectsFile -Raw | ConvertFrom-Json)

$projects = @($projects | Where-Object { $_.name -ne $Name })

$projects += [PSCustomObject]@{
  name = $Name
  relativePath = $relativePath
  addedAt = (Get-Date).ToString("s")
}

ConvertTo-Json -InputObject @($projects) -Depth 10 | Out-File $projectsFile -Encoding utf8

Write-Host ""
Write-Host "Projeto adicionado:" -ForegroundColor Green
Write-Host "Nome:          $Name"
Write-Host "Path:          $projectResolved"
Write-Host "RelativePath:  $relativePath"
Write-Host ""