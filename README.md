# Hermes Project Map

Mapa de projetos para explorar estrutura, símbolos e dependências através de uma API local e uma UI web.

O projeto começou como **Hermes .NET Map** e agora tem uma base incremental para suportar múltiplos tipos de projeto, mantendo o suporte `.NET` atual e adicionando um analyzer TypeScript inicial.

## Documentação

- [Como adicionar projetos](./docs/adding-projects.md)
- [Implementação dos analyzers](./docs/analyzers-implementation.md)
- [Execução e troubleshooting](./docs/analyzers-execution.md)
- [Integração como tool no Hermes](./docs/hermes-tool-integration.md)

## O que faz

- Lista projetos registados em `data/projects.json`.
- Analisa projetos `.NET` usando o analyzer existente baseado em `symbol-index.js`.
- Analisa projetos TypeScript/React/Next.js com suporte inicial baseado em `ts-morph`.
- Expõe endpoints para:
  - listar projetos;
  - ver estrutura;
  - pesquisar símbolos;
  - expandir dependências/referências;
  - obter grafo completo.
- Serve uma UI web estática a partir de `src/public`.

## Suporte atual

| Tipo | Estado | Notas |
|---|---|---|
| `.NET` | Suportado | Mantém o caminho antigo via wrapper e fallback para `symbol-index.js`. |
| `TypeScript` / `React` / `Next.js` | Inicial | Extrai ficheiros, exports, componentes, hooks, providers, interfaces/types e imports internos básicos. |
| `Node.js` | Detetado | Ainda sem analyzer completo dedicado. |
| `Python` | Detetado | Ainda sem analyzer dedicado. |

## Estrutura principal

```txt
src/
  server.js                         # entrada HTTP
  routes/                           # rotas da API
  lib/
    analyzer-service.js             # dispatcher multi-analyzer
    projects.js                     # leitura de data/projects.json
    symbol-index.js                 # analyzer .NET existente
  analyzers/
    common/analyzer-detection.js    # deteção de tipo de projeto
    dotnet/dotnet-analyzer.js       # wrapper .NET
    typescript/typescript-analyzer.js
  public/                           # UI web
scripts/
  add-hermes-dotnet-project.ps1
  list-hermes-dotnet-projects.ps1
  remove-hermes-dotnet-project.ps1
data/
  projects.json
```

## Quick start local

Instalar dependências:

```bash
npm install
```

Validar sintaxe:

```bash
npm run check
```

Correr testes:

```bash
npm test
```

Arrancar servidor:

```bash
npm start
```

Por omissão:

```txt
http://localhost:8770
```

Health check:

```bash
curl http://localhost:8770/api/health
```

## Quick start Docker

Criar `.env`:

```powershell
copy .env.example .env
```

Exemplo:

```env
PROJECTS_ROOT=C:/Users/aiino/Documents
PORT=8770
DOTNET_VERSION=10.0
```

Subir com rebuild:

```bash
docker compose up --build
```

A pasta `PROJECTS_ROOT` é montada no container em `/projects`.

## Adicionar projetos

Ver guia completo:

- [docs/adding-projects.md](./docs/adding-projects.md)

Exemplo PowerShell:

```powershell
.\scripts\add-hermes-dotnet-project.ps1 -Name "faturas-backend" -Path "C:\Users\aiino\Documents\Faturas"
```

Apesar do nome do script conter `dotnet`, o registo é genérico. O tipo real é detetado pelo analyzer.

## Endpoints principais

### Health

```txt
GET /api/health
```

### Projetos

```txt
GET /api/projects
GET /api/projects/:name
GET /api/projects/:name/structure
```

### Exploração

```txt
GET /api/explore/:project/search?q=...
GET /api/explore/:project/expand?nodeId=...&direction=both|in|out
GET /api/explore/:project/full?nodeLimit=500&edgeLimit=1200
```

### Indexação e cache

```txt
POST /api/index/:project
GET /api/cache/symbols
DELETE /api/cache/symbols
```

## Exemplos de uso

Pesquisar símbolo `.NET`:

```bash
curl "http://localhost:8770/api/explore/faturas-backend/search?q=InvoiceCreationService"
```

Pesquisar símbolo TypeScript:

```bash
curl "http://localhost:8770/api/explore/site-next/search?q=Provider"
```

Obter grafo completo:

```bash
curl "http://localhost:8770/api/explore/faturas-backend/full?nodeLimit=500&edgeLimit=1200"
```

## Desenvolvimento

Comandos npm disponíveis:

```bash
npm run check
npm test
npm start
```

Quando mexeres em imports ESM, valida também:

```bash
node -e "import('./src/lib/analyzer-service.js').then(()=>console.log('import ok')).catch(e=>{console.error(e); process.exit(1)})"
```

## Troubleshooting

### `ERR_MODULE_NOT_FOUND`

Verifica imports relativos. Exemplo correto a partir de `src/lib/analyzer-service.js`:

```js
../analyzers/common/analyzer-detection.js
../analyzers/dotnet/dotnet-analyzer.js
../analyzers/typescript/typescript-analyzer.js
```

Mais detalhes:

- [Execução e troubleshooting](./docs/analyzers-execution.md)

### Dependências novas no Docker

Se foram adicionadas dependências npm, faz:

```bash
docker compose up --build
```

## Roadmap curto

- Melhorar resolução de imports TypeScript.
- Suportar `export default`, reexports e aliases de `tsconfig.paths`.
- Adicionar testes para `analyzer-service` e `typescript-analyzer`.
- Renomear scripts PowerShell para nomes genéricos sem `dotnet`.
- Criar tool Hermes ou plugin para consumir esta API diretamente.

## Navegação

- [Como adicionar projetos](./docs/adding-projects.md)
- [Implementação dos analyzers](./docs/analyzers-implementation.md)
- [Execução e troubleshooting](./docs/analyzers-execution.md)
- [Integração como tool no Hermes](./docs/hermes-tool-integration.md)
