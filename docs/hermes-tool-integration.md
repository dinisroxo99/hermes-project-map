# Integração como tool no Hermes

## Objetivo

Transformar o `hermes-project-map` numa capacidade utilizável diretamente pelo Hermes Agent, para que o agente consiga consultar grafos de projetos sem depender da UI.

A integração pode ser feita de duas formas:

1. **Tool Hermes local/core** — ferramenta Python registada no Hermes.
2. **Plugin/MCP separado** — recomendado se o `hermes-project-map` continuar como serviço independente.

## Opção recomendada

Para este caso, a opção mais limpa é manter o `hermes-project-map` como serviço HTTP e criar uma tool Hermes que chama os endpoints existentes.

Motivos:

- evita reimplementar análise em Python;
- preserva o servidor Node.js já existente;
- permite evoluir UI e API separadamente;
- a tool Hermes fica pequena e fácil de manter;
- o mesmo backend serve UI, CLI, Hermes e futuras integrações.

## Endpoints usados pela tool

A tool Hermes deve chamar estes endpoints:

```txt
GET /api/projects
GET /api/projects/:name/structure
GET /api/explore/:project/search?q=...
GET /api/explore/:project/expand?nodeId=...&direction=both|in|out
GET /api/explore/:project/full?nodeLimit=500&edgeLimit=1200
POST /api/index/:project
GET /api/cache/symbols
DELETE /api/cache/symbols
```

## Tools Hermes sugeridas

### `project_map_projects`

Lista projetos disponíveis no `hermes-project-map`.

Input:

```json
{}
```

Output:

```json
{
  "projects": [
    {
      "name": "faturas-backend",
      "relativePath": "...",
      "exists": true,
      "csprojCount": 4,
      "slnCount": 1
    }
  ]
}
```

### `project_map_structure`

Obtém estrutura de um projeto.

Input:

```json
{
  "project": "faturas-backend"
}
```

Chama:

```txt
GET /api/projects/:name/structure
```

### `project_map_search`

Pesquisa símbolos no projeto.

Input:

```json
{
  "project": "faturas-backend",
  "query": "InvoiceCreationService"
}
```

Chama:

```txt
GET /api/explore/:project/search?q=...
```

### `project_map_expand`

Expande dependências/referências de um nó.

Input:

```json
{
  "project": "faturas-backend",
  "nodeId": "...",
  "direction": "both"
}
```

Chama:

```txt
GET /api/explore/:project/expand?nodeId=...&direction=...
```

### `project_map_full_graph`

Obtém grafo completo com limites.

Input:

```json
{
  "project": "faturas-backend",
  "nodeLimit": 500,
  "edgeLimit": 1200,
  "layers": [],
  "features": []
}
```

Chama:

```txt
GET /api/explore/:project/full?nodeLimit=...&edgeLimit=...
```

## Shape recomendado da tool Python

Num Hermes core tool ou plugin, a implementação deve ser pequena:

```python
import json
import os
import urllib.parse
import urllib.request

from tools.registry import registry

BASE_URL = os.getenv("PROJECT_MAP_URL", "http://localhost:8770")


def _request(path: str) -> dict:
    url = f"{BASE_URL}{path}"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def project_map_search(project: str, query: str) -> str:
    encoded_project = urllib.parse.quote(project, safe="")
    encoded_query = urllib.parse.quote(query, safe="")
    data = _request(f"/api/explore/{encoded_project}/search?q={encoded_query}")
    return json.dumps(data, ensure_ascii=False)
```

## Registo com `registry.register`

Exemplo para `project_map_search`:

```python
registry.register(
    name="project_map_search",
    toolset="project_map",
    schema={
        "name": "project_map_search",
        "description": "Search symbols in a project registered in hermes-project-map.",
        "parameters": {
            "type": "object",
            "properties": {
                "project": {
                    "type": "string",
                    "description": "Registered project name, e.g. faturas-backend."
                },
                "query": {
                    "type": "string",
                    "description": "Symbol or text to search for."
                }
            },
            "required": ["project", "query"]
        }
    },
    handler=lambda args, **kw: project_map_search(
        project=args["project"],
        query=args["query"],
    ),
    check_fn=lambda: True,
)
```

## Configuração Hermes

### Variável de ambiente

Adicionar no ambiente do Hermes:

```bash
PROJECT_MAP_URL=http://localhost:8770
```

Se o Hermes corre noutro container ou host, usar o hostname correto:

```bash
PROJECT_MAP_URL=http://hermes-project-map:8770
```

### Toolset

Adicionar as tools a um toolset dedicado:

```txt
project_map
```

Ou incluir em toolsets existentes apenas quando fizer sentido.

## Alternativa via plugin

Se não for para mexer no core do Hermes, criar um plugin local é melhor.

Estrutura sugerida:

```txt
~/.hermes/plugins/project_map/
  plugin.yaml
  tools/
    project_map_tool.py
```

Vantagens:

- não altera o core Hermes;
- pode ser ativado/desativado por perfil;
- facilita testes locais;
- encaixa melhor se este projeto for específico do teu workflow.

## Alternativa via MCP

Outra opção é expor o `hermes-project-map` como MCP server.

Quando usar MCP:

- se quiseres consumir a mesma análise por Hermes, Claude Desktop, Cursor ou outros clientes MCP;
- se quiseres uma interface standard para ferramentas externas;
- se o project-map evoluir para serviço independente com várias operações.

Shape conceptual MCP:

```txt
tools/list_projects
tools/project_structure
tools/search_symbols
tools/expand_symbol
tools/full_graph
```

## Regras importantes para a tool

- A tool deve devolver JSON string válido.
- Não deve imprimir HTML/texto livre em caso de erro.
- Deve incluir erros claros quando o serviço não está disponível.
- Deve ter timeout explícito.
- Deve validar inputs mínimos (`project`, `query`, `nodeId`).
- Não deve expor paths locais sensíveis além do que a API já devolve.
- Deve manter limites por defeito (`nodeLimit`, `edgeLimit`) para não encher contexto.

## Erros que a tool deve tratar

### Serviço desligado

Mensagem sugerida:

```json
{
  "success": false,
  "error": "project_map_unavailable",
  "message": "hermes-project-map is not reachable at PROJECT_MAP_URL. Start it with npm start or docker compose up."
}
```

### Projeto inexistente

Propagar o erro da API:

```json
{
  "success": false,
  "error": "not_found",
  "message": "Projeto não encontrado: ..."
}
```

### Resposta demasiado grande

Aplicar limites:

```json
{
  "nodeLimit": 500,
  "edgeLimit": 1200
}
```

## Critérios de aprovação para implementar a tool

- `project_map_projects` lista projetos reais.
- `project_map_search` funciona para `faturas-backend`.
- `project_map_expand` expande um nó obtido pela pesquisa.
- `project_map_full_graph` respeita `nodeLimit` e `edgeLimit`.
- Erro de serviço desligado é legível.
- Toolset pode ser ativado/desativado no Hermes.
- Não há dependência da UI.

## Plano de implementação sugerido

### Commit 1 — plugin/tool mínima

```txt
feat(project-map): add Hermes project map tool
```

Inclui:

- cliente HTTP;
- `project_map_projects`;
- `project_map_search`;
- configuração `PROJECT_MAP_URL`.

### Commit 2 — expansão e grafo

```txt
feat(project-map): add expand and full graph tools
```

Inclui:

- `project_map_expand`;
- `project_map_full_graph`;
- limites e validações.

### Commit 3 — documentação e exemplos

```txt
docs(project-map): document Hermes tool integration
```

Inclui:

- exemplos de uso;
- troubleshooting;
- configuração por Docker/local.

## Próximo passo recomendado

Criar primeiro a tool como plugin local, não no core. Depois de estabilizar o shape dos inputs/outputs, decidir se vale a pena promover para toolset core do Hermes.
