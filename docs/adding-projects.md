# Adding projects

[← README](../README.md) · [Implementation](./analyzers-implementation.md) · [Execution](./analyzers-execution.md) · [Hermes integration](./hermes-tool-integration.md)

## Purpose

This guide explains how to add, list, and remove projects in `hermes-project-map`.

Registered projects are stored in `data/projects.json` and read by the API through `src/lib/projects.js`.

## How it works

`hermes-project-map` does not store absolute project paths. It stores only:

```json
{
  "name": "faturas-backend",
  "relativePath": "Faturas",
  "addedAt": "2026-07-03T13:59:01"
}
```

The real path is calculated like this:

```txt
PROJECTS_ROOT_CONTAINER + relativePath
```

In Docker, `docker-compose.yml` mounts the host directory at `/projects`:

```yaml
volumes:
  - "${PROJECTS_ROOT}:/projects:ro"
```

Therefore:

```txt
Host:      C:/Users/aiino/Documents/Faturas
Container: /projects/Faturas
Record:    relativePath = "Faturas"
```

## Configure `PROJECTS_ROOT`

Create `.env` from the example file:

```powershell
copy .env.example .env
```

Current example:

```env
PROJECTS_ROOT=C:/Users/aiino/Documents
PORT=8770
DOTNET_VERSION=10.0
```

Every added project must be inside `PROJECTS_ROOT`.

Valid examples:

```txt
C:/Users/aiino/Documents/Faturas
C:/Users/aiino/Documents/my-next-app
C:/Users/aiino/Documents/work/project-a
```

Invalid example when `PROJECTS_ROOT=C:/Users/aiino/Documents`:

```txt
D:/Repos/project-a
```

In that case, either change `PROJECTS_ROOT` or move the project into the configured folder.

## Add a project with the script

Use the PowerShell script:

```powershell
.\scripts\add-hermes-dotnet-project.ps1 -Name "faturas-backend" -Path "C:\Users\aiino\Documents\Faturas"
```

Although the script name contains `dotnet`, registration is generic: it adds the project to `data/projects.json`. The analyzer then detects whether the project is `.NET`, `TypeScript`, `Node.js`, and so on.

### TypeScript / Next.js example

```powershell
.\scripts\add-hermes-dotnet-project.ps1 -Name "site-next" -Path "C:\Users\aiino\Documents\site-next"
```

If the project has both `package.json` and `tsconfig.json`, it will be detected as `typescript`.

## Naming rules

The name (`-Name`) must match:

```txt
^[a-zA-Z0-9][a-zA-Z0-9\-_]*$
```

Allowed:

```txt
faturas-backend
site_next
Project123
```

Not recommended / invalid:

```txt
faturas backend
../faturas
faturas/backend
```

## List projects

Via script:

```powershell
.\scripts\list-hermes-dotnet-projects.ps1
```

Via API:

```bash
curl http://localhost:8770/api/projects
```

## Remove a project

Via script:

```powershell
.\scripts\remove-hermes-dotnet-project.ps1 -Name "faturas-backend"
```

This only removes the record from `data/projects.json`. It does not delete the actual project folder.

## Edit `data/projects.json` manually

You can also edit the file manually:

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

Be careful:

- the file must be valid JSON;
- `relativePath` must be relative to `PROJECTS_ROOT`;
- do not use an absolute path in `relativePath`;
- do not point outside `PROJECTS_ROOT`.

## Validate after adding a project

### 1. Confirm that it appears in the API

```bash
curl http://localhost:8770/api/projects
```

### 2. Confirm the structure

```bash
curl http://localhost:8770/api/projects/faturas-backend/structure
```

### 3. Search for a symbol

For `.NET`:

```bash
curl "http://localhost:8770/api/explore/faturas-backend/search?q=InvoiceCreationService"
```

For TypeScript:

```bash
curl "http://localhost:8770/api/explore/site-next/search?q=Provider"
```

### 4. Retrieve the graph

```bash
curl "http://localhost:8770/api/explore/faturas-backend/full?nodeLimit=500&edgeLimit=1200"
```

## Use with Docker

After changing `.env` or `data/projects.json`, restart the service.

If you only changed `data/projects.json`:

```bash
docker compose restart
```

If you changed dependencies, the Dockerfile, or want to guarantee a clean environment:

```bash
docker compose up --build
```

## Troubleshooting

### `Project folder not found in container`

Likely cause:

- `relativePath` does not exist inside `/projects`;
- `PROJECTS_ROOT` points to the wrong folder;
- the container was not restarted after changing `.env`.

Check:

```txt
PROJECTS_ROOT=C:/Users/aiino/Documents
relativePath=Faturas
```

This should map to:

```txt
/projects/Faturas
```

### `The project must be inside PROJECTS_ROOT`

The script blocks projects outside `PROJECTS_ROOT` to keep the Docker mapping simple.

Solution:

- change `PROJECTS_ROOT`; or
- move the project inside `PROJECTS_ROOT`.

### TypeScript project appears empty

Check whether there are relevant files outside ignored directories:

```txt
.ts
.tsx
.js
.jsx
```

Ignored directories:

```txt
node_modules
.next
dist
build
coverage
```

### Dependency error in Docker

If you see something like `Cannot find package 'ts-morph'`, rebuild:

```bash
docker compose up --build
```

## Recommended next steps

- Eventually rename the `*-dotnet-project.ps1` scripts to generic names, for example:
  - `add-hermes-project.ps1`
  - `list-hermes-projects.ps1`
  - `remove-hermes-project.ps1`
- Add tests to validate `data/projects.json`.
- Improve detection for TypeScript monorepos with `tsconfig.json` in subfolders.
