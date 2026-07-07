# Plano de Implementação - Modo 3D Avançado para Hermes .NET Map

## Visão Geral

Este documento descreve a implementação faseada do modo 3D avançado para o explorador de dependências .NET/C#. O plano segue a arquitetura existente (Node.js backend + frontend HTML/CSS/JS com Cytoscape.js 2D e 3d-force-graph 3D) e mantém compatibilidade total com o modo incremental atual.

---

## Fases de Implementação

### FASE 1: Backend - Endpoint `/api/explore/:project/full`

**Objetivo**: Criar endpoint que devolve o grafo completo do projeto com limites configuráveis.

#### 1.1 Modificar `src/lib/symbol-index.js`

**Nova função `getFullGraphExplorer(project, options)`**:
- Parâmetros: `project`, `options = { nodeLimit: 500, edgeLimit: 1200 }`
- Usar `getSymbolIndex(project)` (cache existente)
- Converter todos os símbolos via `toGraphNode`
- Construir edges a partir de `outgoingById` evitando duplicados com `Set`
- Ordenar símbolos por relevância (prioridade):
  1. `controller` / `api`
  2. `service` / `handler` / `application`
  3. `interface`
  4. `domain`
  5. `infrastructure` / `repository` / `database`
  6. `contract` / `enum`
  7. `middleware` / `extension` / `unknown`
- Aplicar limite de nós (slice após ordenação)
- Filtrar edges apenas entre nós incluídos
- Retornar objeto:
  ```js
  {
    nodes: [...],
    edges: [...],
    limited: boolean,
    originalNodeCount: number,
    originalEdgeCount: number,
    message: string
  }
  ```

#### 1.2 Modificar `src/server.js`

**Nova rota**: `GET /api/explore/:project/full?nodeLimit=500&edgeLimit=1200`
- Validar project existe
- Ler query params `nodeLimit`, `edgeLimit` (com defaults)
- Chamar `getFullGraphExplorer(project, { nodeLimit, edgeLimit })`
- Devolver JSON

---

### FASE 2: Frontend - UI e Estado

#### 2.1 Modificar `src/public/index.html`

**Adicionar ao painel esquerdo**:
- Botão "Carregar projeto todo" (id: `loadFullBtn`)
- Inputs opcionais para limites:
  - `nodeLimitInput` (number, default 500)
  - `edgeLimitInput` (number, default 1200)
- Botões de vista (já existem: 2D, 3D, Reorganizar, Encaixar, Limpar)

**Painel de detalhes**: Adicionar botões:
- "Isolar vizinhança"
- "Voltar ao grafo completo"

#### 2.2 Modificar `src/public/app.js`

**Estado novo**:
```js
let graphMode = "focused"; // "focused" | "full"
const DEFAULT_FULL_GRAPH_NODE_LIMIT = 500;
const DEFAULT_FULL_GRAPH_EDGE_LIMIT = 1200;
```

**Maps para performance**:
```js
const graphNodesById = new Map();
const graphLinksById = new Map();
let isLoadingFullGraph = false;
```

**Função `addGraphData(result)`**:
- Evita duplicados usando `graphNodesById` e `graphLinksById`
- Adiciona apenas nós/links novos
- Atualiza Cytoscape e 3d-force-graph incrementalmente
- Não reconstrói o grafo inteiro

**Função `loadFullGraph()`**:
- Ler limites dos inputs (ou defaults)
- `isLoadingFullGraph = true`, desabilitar botão
- Chamar `GET /api/explore/:project/full?nodeLimit=...&edgeLimit=...`
- `graphMode = "full"`
- Limpar grafo atual (`cy.elements().remove()`, `graph3d.graphData({nodes:[],links:[]})`)
- `addGraphData(result)`
- `runLayout()` só se 2D; se 3D, `graph3d.zoomToFit()`
- Mostrar mensagem se `result.limited`
- `isLoadingFullGraph = false`

**Modificar `searchSymbols()`**:
- `graphMode = "focused"`
- Limpar grafo antes de adicionar resultados

**Modificar `expandNode()`**:
- Se `graphMode === "full"`: usar `addGraphData()` incremental
- Não duplicar nós existentes

**Novos handlers**:
- `isolateNeighbourhood()`: destacar vizinhança do nó selecionado, esconder resto
- `resetToFullGraph()`: voltar ao grafo completo (se `graphMode === "full"`)

---

### FASE 3: Melhorar 3d-force-graph (Rotação Livre)

#### 3.1 Configurar OrbitControls em `initGraph3D()`

```js
function initGraph3D() {
  graph3d = ForceGraph3D()(graph3dEl)
    .backgroundColor("#020617")
    .enableNodeDrag(true)
    .enableNavigationControls(true)
    // OrbitControls padrão do three.js:
    .controls(() => {
      // Acessar controls internos se expostos
    })
    // Forçar configurações:
    .onEngineTick(() => {
      if (graph3d._controls) {
        graph3d._controls.enableRotate = true;
        graph3d._controls.enableZoom = true;
        graph3d._controls.enablePan = true;
        graph3d._controls.enableDamping = true;
        graph3d._controls.rotateSpeed = 0.7;
        graph3d._controls.zoomSpeed = 1.2;
        graph3d._controls.panSpeed = 0.8;
        graph3d._controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
      }
    });
}
```

**Nota**: 3d-force-graph expõe `graph3d.controls()` para acessar OrbitControls. Verificar API.

---

### FASE 4: Melhorar Experiência Visual 3D

#### 4.1 Cores por Categoria (já definido em `CATEGORY` object)

Estender para 3D garantir que `nodeColor` usa a mesma paleta:
- `controller/api`: `#60a5fa` (azul) / `#3b82f6`
- `service/handler`: `#a78bfa` (roxo)
- `application`: `#c084fc` (lilás)
- `domain/entity`: `#34d399` (verde)
- `interface`: `#22d3ee` (cyan)
- `repository`: `#f59e0b` (amarelo/laranja)
- `database`: `#fb923c` (laranja forte)
- `infrastructure`: `#f97316` (laranja)
- `contract/dto/request/response`: `#facc15` (amarelo)
- `middleware`: `#38bdf8` (azul claro)
- `extension`: `#94a3b8` (cinzento)
- `unknown`: `#64748b` (cinzento)

#### 4.2 Tamanho dos Nós por Importância

```js
function getNodeSize3D(node) {
  if (node.category === "controller" || node.category === "api") return 6;
  if (node.category === "service" || node.category === "application") return 5.5;
  if (node.category === "domain") return 5;
  if (node.category === "interface") return 4.5;
  if (node.category === "contract" || node.category === "enum") return 4;
  return 4;
}
```

#### 4.3 Links com Setas Direcionais

- `uses`: laranja (`#f59e0b`)
- `references`: azul (`#60a5fa`)
- Configurar `.linkDirectionalArrowLength(4)`, `.linkDirectionalArrowRelPos(1)`

#### 4.4 Labels Inteligentes

```js
.nodeLabel((node) => {
  if (!selectedNodeId) return "";
  if (node.id === selectedNodeId || isNeighbour3D(node.id)) {
    return node.label;
  }
  return "";
})
```

#### 4.5 Tooltip Rico

Usar `.onNodeHover()` para mostrar tooltip customizado com:
- nome, categoria, projeto, namespace, ficheiro

---

### FASE 5: Seleção e Detalhes no 3D

#### 5.1 Seleção Visual

Em `.nodeColor()`:
- Nó selecionado: branco (`#ffffff`) com halo/borda
- Vizinhos: cor normal
- Restantes: esbatidos (`#334155`)

Em `.linkWidth()`:
- Links do nó selecionado: espessura 3
- Outros: 0.6

#### 5.2 Painel de Detalhes (reutilizar `renderDetails`)

- `onNodeClick` já chama `selectNode(node.id)` que usa `renderDetails`
- Adicionar botões novos no `renderDetails`:
  - "Isolar vizinhança"
  - "Voltar ao grafo completo"

---

### FASE 6: Expansão por Duplo Clique

Já implementado parcialmente em `onNodeClick` com detecção de duplo clique (`last3DClick`).

**Melhorar**:
- Se `graphMode === "full"`: chamar endpoint expand mas usar `addGraphData()` incremental
- Posicionar novos nós perto do nó expandido (3d-force-graph faz isso automaticamente com force layout)
- Não reler projeto, não recriar grafo

---

### FASE 7: Alternância de Modos

**Estados**:
- `graphMode = "focused"`: pesquisa incremental, grafo limpo a cada pesquisa
- `graphMode = "full"`: grafo global, expansão incrementa

**Transições**:
- Pesquisa → `focused`, limpa tudo
- "Carregar projeto todo" → `full`, limpa tudo, carrega global
- Expandir em `full` → incrementa apenas novos

---

### FASE 8: Performance

- [x] Maps `graphNodesById`, `graphLinksById` no frontend
- [x] `addGraphData()` evita duplicados
- [x] Limites configuráveis (DEFAULT_FULL_GRAPH_NODE_LIMIT = 500, EDGE_LIMIT = 1200)
- [x] Debounce/bloqueio durante carregamento (`isLoadingFullGraph`)
- [x] Não executar layout 2D em modo 3D
- [x] Não recriar ForceGraph3D - usar `.graphData()` apenas quando necessário
- [x] Backend: reutilizar cache `getSymbolIndex()`, não reler ficheiros

---

### FASE 9: Testes e Validação

**Critérios de Aceitação**:
1. ✅ Abrir projeto faturas-backend
2. ✅ Pesquisar "InvoiceCreationService" e expandir normalmente
3. ✅ Mudar para 3D
4. ✅ Rodar livremente o grafo 3D com rato (botão esquerdo)
5. ✅ Scroll para zoom
6. ✅ Clicar nó → ver detalhes painel direito
7. ✅ Duplo clique → expandir
8. ✅ "Carregar projeto todo" → grafo global 3D com cores
9. ✅ Projeto grande → limitado + mensagem com contagem original
10. ✅ UI não bloqueia completamente
11. ✅ Modo 2D continua funcional

---

## Ordem de Commits Sugerida

1. **feat(backend): add getFullGraphExplorer function to symbol-index.js**
2. **feat(backend): add GET /api/explore/:project/full endpoint**
3. **feat(frontend): add "Carregar projeto todo" button and limit inputs to UI**
4. **feat(frontend): implement graphMode state and addGraphData function**
5. **feat(frontend): implement loadFullGraph with loading state**
6. **feat(3d): configure OrbitControls for free rotation, zoom, pan**
7. **feat(3d): improve visual experience - colors, sizes, arrows, labels, tooltips**
8. **feat(3d): enhance node selection highlighting and link emphasis**
9. **feat(frontend): add isolate neighbourhood and reset to full graph buttons**
10. **refactor: integrate expandNode with graphMode for incremental updates**
11. **test: validate all acceptance criteria**

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/lib/symbol-index.js` | Adicionar `getFullGraphExplorer()` |
| `src/server.js` | Adicionar rota `/api/explore/:project/full` |
| `src/public/index.html` | Adicionar botão "Carregar projeto todo", inputs limites, botões detalhes |
| `src/public/style.css` | Estilos para novos elementos UI |
| `src/public/app.js` | Lógica principal: graphMode, addGraphData, loadFullGraph, 3D improvements |

---

## Notas Técnicas Importantes

1. **Não remover** modo 2D existente (Cytoscape)
2. **Não remover** pesquisa incremental existente
3. **Não reimplementar** análise por varrimento - usar Maps/Dictionaries do índice
4. **Priorizar** performance e navegação fluida
5. **Reutilizar** `toGraphNode`, `classifySymbol`, `CATEGORY` já existentes
6. **Cache backend** já implementado em `getSymbolIndex()` - não reler ficheiros
7. **3d-force-graph** usa Three.js internamente - OrbitControls acessível via `.controls()`

---

## Referências de API 3d-force-graph

- `.backgroundColor(color)`
- `.nodeColor(fn)`
- `.nodeVal(fn)` - tamanho
- `.linkColor(fn)`
- `.linkWidth(fn)`
- `.linkDirectionalArrowLength(n)`
- `.linkDirectionalArrowRelPos(n)`
- `.linkCurvature(n)`
- `.cooldownTicks(n)`
- `.onNodeClick(fn)`
- `.onNodeHover(fn)`
- `.onNodeDragEnd(fn)`
- `.controls()` - retorna OrbitControls do Three.js
- `.graphData({nodes, links})` - atualizar dados
- `.zoomToFit(duration, padding)`
- `.cameraPosition(position, lookAt, duration)`
- `.width(w)`, `.height(h)`