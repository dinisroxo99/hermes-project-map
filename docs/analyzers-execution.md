# Execução — Project analyzers

[← README](../README.md) · [Adicionar projetos](./adding-projects.md) · [Implementação](./analyzers-implementation.md) · [Integração Hermes](./hermes-tool-integration.md)

## Objetivo

Guia operacional para correr, validar e diagnosticar o `hermes-project-map` depois da introdução do `analyzer-service` e do analyzer TypeScript inicial.

## Pré-requisitos

- Node.js compatível com o projeto.
- Dependências instaladas com `npm install`.
- Projetos configurados em `data/projects.json`.
- Quando usado em Docker, o container tem de incluir as novas dependências (`ts-morph` e `typescript`).

## Instalação local

```bash
npm install
```

As dependências relevantes para o analyzer TypeScript são:

```txt
ts-morph
typescript
```

## Validação rápida

### Syntax check

```bash
npm run check
```

Resultado esperado:

```txt
node --check src/server.js && node --check src/public/app.js && node --check src/public/api-client.js
```

### Testes

```bash
npm test
```

Resultado esperado no estado atual:

```txt
15/15 tests passing
```

### Validar import do analyzer-service

Útil para apanhar erros de paths ESM antes de arrancar o servidor:

```bash
node -e "import('./src/lib/analyzer-service.js').then(()=>console.log('import ok')).catch(e=>{console.error(e); process.exit(1)})"
```

Resultado esperado:

```txt
import ok
```

## Arranque local

```bash
npm start
```

Por omissão o servidor usa:

```txt
PORT=8770
```

Health check:

```bash
curl http://localhost:8770/api/health
```

## Execução com Docker

Como foram adicionadas dependências novas, o caminho seguro é rebuildar:

```bash
docker compose up --build
```

Se o projeto estiver com bind mount e as dependências já tiverem sido instaladas dentro do container, um restart pode chegar, mas o rebuild evita erros de módulo ausente.

## Endpoints principais

### Listar projetos

```bash
curl http://localhost:8770/api/projects
```

### Estrutura do projeto

```bash
curl http://localhost:8770/api/projects/<projectName>/structure
```

### Pesquisar símbolos

```bash
curl "http://localhost:8770/api/explore/<projectName>/search?q=InvoiceCreationService"
```

Para TypeScript:

```bash
curl "http://localhost:8770/api/explore/<projectName>/search?q=Provider"
```

### Expandir nó

```bash
curl "http://localhost:8770/api/explore/<projectName>/expand?nodeId=<nodeId>&direction=both"
```

Valores aceites para `direction`:

- `both`
- `in`
- `out`

### Grafo completo

```bash
curl "http://localhost:8770/api/explore/<projectName>/full?nodeLimit=500&edgeLimit=1200"
```

Filtros opcionais:

```bash
curl "http://localhost:8770/api/explore/<projectName>/full?layers=presentation,logic&features=auth,billing"
```

## Diagnóstico de erros comuns

### `ERR_MODULE_NOT_FOUND` em `analyzer-service.js`

Sintoma típico:

```txt
Cannot find module '/app/src/lib/common/analyzer-detection.js'
```

Causa provável:

- import relativo errado a partir de `src/lib/analyzer-service.js`.

Caminhos corretos:

```js
../analyzers/common/analyzer-detection.js
../analyzers/dotnet/dotnet-analyzer.js
../analyzers/typescript/typescript-analyzer.js
```

Validação:

```bash
node -e "import('./src/lib/analyzer-service.js').then(()=>console.log('import ok')).catch(e=>{console.error(e); process.exit(1)})"
```

### Dependência não encontrada no Docker

Sintoma:

```txt
Cannot find package 'ts-morph'
```

Correção:

```bash
docker compose up --build
```

ou, dentro do ambiente correto:

```bash
npm install
```

### Projeto TypeScript detetado como `nodejs` ou `unknown`

Verificar se o projeto tem pelo menos um destes sinais na raiz:

- `tsconfig.json`;
- ficheiro `.ts` na raiz;
- `package.json` com estrutura JS/TS reconhecida.

Nota: a deteção inicial ainda é simples e pode precisar de melhoria para monorepos ou projetos com `tsconfig` em subpastas.

### Grafo vazio para TypeScript

Possíveis causas:

- não existem ficheiros `.ts`, `.tsx`, `.js` ou `.jsx` fora dos diretórios ignorados;
- o projeto só tem exports default ou reexports ainda não cobertos;
- os ficheiros estão em paths ignorados (`dist`, `.next`, `build`, etc.);
- `nodeLimit` demasiado baixo.

## Checklist antes de dizer que está OK

1. `npm install` executado no ambiente certo.
2. `npm run check` passa.
3. `npm test` passa.
4. `node -e import('./src/lib/analyzer-service.js')` passa.
5. Servidor arranca sem `ERR_MODULE_NOT_FOUND`.
6. Endpoint `.NET` existente continua a responder.
7. Endpoint TypeScript devolve nodes quando apontado para um projeto TS real.

## Próximos passos operacionais

- Criar um projeto TypeScript pequeno de teste em `data/projects.json`.
- Validar `search`, `expand` e `full` com esse projeto.
- Adicionar testes automatizados para garantir que imports ESM e deteção de tipo não voltam a partir.
