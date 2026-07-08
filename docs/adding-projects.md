# Adicionar projetos

[← README](../README.md) · [Implementação](./analyzers-implementation.md) · [Execução](./analyzers-execution.md) · [Integração Hermes](./hermes-tool-integration.md)

## Objetivo

Este guia explica como adicionar, listar e remover projetos no `hermes-project-map`.

Os projetos registados ficam em `data/projects.json` e são lidos pela API através de `src/lib/projects.js`.

## Como funciona

O `hermes-project-map` não guarda caminhos absolutos dos projetos. Guarda apenas:

```json
{
  "name": "faturas-backend",
  "relativePath": "Faturas",
  "addedAt": "2026-07-03T13:59:01"
}
```

O caminho real é calculado assim:

```txt
PROJECTS_ROOT_CONTAINER + relativePath
```

Em Docker, o `docker-compose.yml` monta o diretório do host em `/projects`:

```yaml
volumes:
  - "${PROJECTS_ROOT}:/projects:ro"
```

Por isso:

```txt
Host:      C:/Users/aiino/Documents/Faturas
Container: /projects/Faturas
Registro:  relativePath = "Faturas"
```

## Configurar `PROJECTS_ROOT`

Cria o `.env` a partir do exemplo:

```powershell
copy .env.example .env
```

Exemplo atual:

```env
PROJECTS_ROOT=C:/Users/aiino/Documents
PORT=8770
DOTNET_VERSION=10.0
```

Todos os projetos adicionados têm de estar dentro de `PROJECTS_ROOT`.

Exemplos válidos:

```txt
C:/Users/aiino/Documents/Faturas
C:/Users/aiino/Documents/my-next-app
C:/Users/aiino/Documents/work/project-a
```

Exemplo inválido, se `PROJECTS_ROOT=C:/Users/aiino/Documents`:

```txt
D:/Repos/project-a
```

Nesse caso, muda `PROJECTS_ROOT` ou move o projeto para dentro da pasta configurada.

## Adicionar projeto com script

Usa o script PowerShell:

```powershell
.\scripts\add-hermes-dotnet-project.ps1 -Name "faturas-backend" -Path "C:\Users\aiino\Documents\Faturas"
```

Apesar do nome do script conter `dotnet`, o registo é genérico: ele adiciona o projeto ao `data/projects.json`. O analyzer depois deteta se é `.NET`, `TypeScript`, `Node.js`, etc.

### Exemplo TypeScript / Next.js

```powershell
.\scripts\add-hermes-dotnet-project.ps1 -Name "site-next" -Path "C:\Users\aiino\Documents\site-next"
```

Se o projeto tiver `package.json` e `tsconfig.json`, será detetado como `typescript`.

## Regras para o nome

O nome (`-Name`) tem de cumprir:

```txt
^[a-zA-Z0-9][a-zA-Z0-9\-_]*$
```

Permitido:

```txt
faturas-backend
site_next
Project123
```

Não recomendado / inválido:

```txt
faturas backend
../faturas
faturas/backend
```

## Listar projetos

Via script:

```powershell
.\scripts\list-hermes-dotnet-projects.ps1
```

Via API:

```bash
curl http://localhost:8770/api/projects
```

## Remover projeto

Via script:

```powershell
.\scripts\remove-hermes-dotnet-project.ps1 -Name "faturas-backend"
```

Isto remove apenas o registo de `data/projects.json`. Não apaga a pasta real do projeto.

## Editar manualmente `data/projects.json`

Também podes editar manualmente:

```json
[
  {
    "name": "faturas-backend",
    "relativePath": "Faturas",
    "addedAt": "2026-07-03T13:59:01"
  },
  {
    "name": "site-next",
    "relativePath": "site-next",
    "addedAt": "2026-07-07T18:00:00"
  }
]
```

Cuidados:

- o ficheiro tem de ser JSON válido;
- `relativePath` deve ser relativo a `PROJECTS_ROOT`;
- não uses caminho absoluto em `relativePath`;
- não apontes para fora de `PROJECTS_ROOT`.

## Validar depois de adicionar

### 1. Confirmar que aparece na API

```bash
curl http://localhost:8770/api/projects
```

### 2. Confirmar estrutura

```bash
curl http://localhost:8770/api/projects/faturas-backend/structure
```

### 3. Pesquisar símbolo

Para `.NET`:

```bash
curl "http://localhost:8770/api/explore/faturas-backend/search?q=InvoiceCreationService"
```

Para TypeScript:

```bash
curl "http://localhost:8770/api/explore/site-next/search?q=Provider"
```

### 4. Obter grafo

```bash
curl "http://localhost:8770/api/explore/faturas-backend/full?nodeLimit=500&edgeLimit=1200"
```

## Usar com Docker

Depois de alterar `.env` ou `data/projects.json`, reinicia o serviço.

Se só alteraste `data/projects.json`:

```bash
docker compose restart
```

Se alteraste dependências, Dockerfile ou queres garantir ambiente limpo:

```bash
docker compose up --build
```

## Troubleshooting

### `Pasta do projeto não encontrada no container`

Causa provável:

- `relativePath` não existe dentro de `/projects`;
- `PROJECTS_ROOT` aponta para a pasta errada;
- o container não foi reiniciado depois de mudar `.env`.

Verifica:

```txt
PROJECTS_ROOT=C:/Users/aiino/Documents
relativePath=Faturas
```

Isto deve mapear para:

```txt
/projects/Faturas
```

### `O projeto tem de estar dentro de PROJECTS_ROOT`

O script bloqueia projetos fora de `PROJECTS_ROOT` para manter o mapeamento Docker simples.

Solução:

- muda `PROJECTS_ROOT`; ou
- move o projeto para dentro de `PROJECTS_ROOT`.

### Projeto TypeScript aparece vazio

Verifica se existem ficheiros relevantes fora dos diretórios ignorados:

```txt
.ts
.tsx
.js
.jsx
```

Diretórios ignorados:

```txt
node_modules
.next
dist
build
coverage
```

### Erro de dependência no Docker

Se aparecer algo como `Cannot find package 'ts-morph'`, faz rebuild:

```bash
docker compose up --build
```

## Próximos passos recomendados

- Renomear futuramente os scripts `*-dotnet-project.ps1` para nomes genéricos, por exemplo:
  - `add-hermes-project.ps1`
  - `list-hermes-projects.ps1`
  - `remove-hermes-project.ps1`
- Adicionar testes para validar `data/projects.json`.
- Melhorar deteção para monorepos TypeScript com `tsconfig.json` em subpastas.
