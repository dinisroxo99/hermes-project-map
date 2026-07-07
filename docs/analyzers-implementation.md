# Implementação — Multi-project analyzers

## Objetivo

Criar uma base mínima para o `hermes-project-map` suportar múltiplos tipos de projeto sem quebrar o suporte .NET existente.

A implementação atual mantém os endpoints públicos e introduz um dispatcher (`analyzer-service`) que escolhe o analyzer adequado com base no tipo de projeto.

## Âmbito implementado

- Suporte atual preservado para projetos `.NET`.
- Suporte inicial para projetos `TypeScript` / `React` / `Next.js`.
- Sem alterações na UI.
- Sem reescrever o analyzer .NET existente.
- Sem alterar os contratos dos endpoints atuais.

## Ficheiros principais

### `src/lib/analyzer-service.js`

Dispatcher central usado pelas rotas.

Responsabilidades:

- detectar o tipo do projeto através de `detectProjectType(project.absolutePath)`;
- delegar `.NET` para `analyzeDotNetProject(...)`;
- delegar `TypeScript` para `analyzeTypeScriptProject(...)`;
- expor funções compatíveis com as rotas atuais:
  - `analyzeProject(project, options)`;
  - `searchSymbols(project, query)`;
  - `expandNode(project, nodeId, direction)`.

### `src/analyzers/common/analyzer-detection.js`

Deteção simples por ficheiros na raiz do projeto.

Tipos reconhecidos:

- `dotnet`: `.csproj`, `.sln` ou `Directory.Build.props`;
- `typescript`: `package.json` com `tsconfig.json` ou ficheiros `.ts`;
- `nodejs`: `package.json` com `.js`/`node_modules`, mas sem sinais TypeScript;
- `python`: `pyproject.toml`, `setup.py` ou `requirements.txt` com ficheiros `.py`;
- `unknown`: fallback.

Tipos atualmente suportados por analyzer:

- `dotnet`;
- `typescript`.

### `src/analyzers/dotnet/dotnet-analyzer.js`

Wrapper fino sobre o código antigo em `src/lib/symbol-index.js`.

Mantém compatibilidade com:

- `searchSymbolExplorer(...)`;
- `expandSymbolExplorer(...)`;
- `getFullGraphExplorer(...)`.

Este ficheiro existe para que o novo dispatcher consiga tratar `.NET` como mais um analyzer sem mexer na implementação antiga.

### `src/analyzers/typescript/typescript-analyzer.js`

Analyzer inicial para projetos TypeScript/JavaScript usando `ts-morph`.

Responsabilidades atuais:

- localizar ficheiros `.ts`, `.tsx`, `.js`, `.jsx`;
- ignorar diretórios pesados ou gerados:
  - `node_modules`;
  - `.next`;
  - `dist`;
  - `build`;
  - `coverage`;
  - `.git`;
  - `.vscode`;
  - `public`;
- extrair símbolos:
  - classes;
  - funções exportadas;
  - interfaces;
  - type aliases;
  - componentes React por nome `CapitalCase`;
  - hooks exportados `use*`;
  - providers por sufixo `Provider`;
- criar `nodes` no formato usado pelo grafo atual;
- criar `edges` a partir de imports internos relativos (`./...` ou `/...`);
- implementar pesquisa e expansão básica para TypeScript.

## Formato dos nodes

O analyzer TypeScript devolve nodes compatíveis com o grafo atual:

```js
{
  id,
  label,
  kind,
  category,
  namespace,
  projectName,
  layer,
  feature,
  file,
  subtitle
}
```

Mapeamento principal:

- `label`: nome do símbolo;
- `kind`: tipo técnico (`class`, `function`, `interface`, `type`, `component`, `hook`);
- `category`: categoria visual/lógica (`component`, `hook`, `provider`, `service`, `context`, etc.);
- `file`: caminho relativo do ficheiro;
- `layer`: inferido pelo path (`components`, `hooks`, `lib`, `services`, `types`);
- `feature`: primeira pasta significativa fora de diretórios comuns.

## Formato dos edges

Os edges TypeScript seguem o shape usado pelo grafo:

```js
{
  id,
  from,
  to,
  relation,
  label
}
```

Atualmente representam imports internos com:

- `relation: "imports"`;
- `label: "importa"` ou `"importa *"`.

## Rotas adaptadas

### `src/routes/explore.routes.js`

As rotas continuam iguais:

- `GET /api/explore/:project/search?q=...`
- `GET /api/explore/:project/expand?nodeId=...&direction=both|in|out`
- `GET /api/explore/:project/full?nodeLimit=500&edgeLimit=1200`

Alteração interna:

- `search` usa `searchSymbols(...)`;
- `expand` usa `expandNode(...)`;
- `full` tenta `analyzeProject(...)` e mantém fallback direto para `getFullGraphExplorer(...)` no caso `.NET`.

## Garantias atuais

- A UI não foi alterada.
- Os endpoints existentes continuam com os mesmos paths.
- `.NET` continua suportado via wrapper e fallback para `symbol-index.js`.
- `faturas-backend` continua a passar pelo caminho `.NET`.
- `TypeScript` ainda é suporte inicial, não analyzer completo.

## Limitações conhecidas

- O analyzer TypeScript ainda não resolve corretamente todos os imports para origem/destino reais; a ligação atual é básica.
- A deteção TypeScript olha principalmente para ficheiros na raiz (`tsconfig.json`, `.ts` na raiz), podendo precisar de melhoria para monorepos.
- O grafo TypeScript ainda não inclui chamadas de função, referências sem import direto, exports default ou reexports complexos.
- A UI ainda não distingue visualmente categorias específicas de frontend.

## Próximos passos técnicos

1. Melhorar resolução de imports internos para mapear ficheiro origem → símbolo destino.
2. Suportar `export default`, `export * from`, barrel files e aliases de `tsconfig.paths`.
3. Adicionar testes dedicados para `analyzer-service` e `typescript-analyzer`.
4. Testar contra um projeto real React/Next.js.
5. Expor a análise como tool Hermes ou MCP/plugin separado.
