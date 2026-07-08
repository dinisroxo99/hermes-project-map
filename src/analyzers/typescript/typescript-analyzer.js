/**
 * TypeScript Analyzer
 *
 * Initial analyzer for TypeScript/JavaScript projects using ts-morph.
 * Extracts imports, exports, React components, hooks, providers, types and interfaces.
 */

import { Project } from 'ts-morph';
import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.git',
  '.vscode',
  'public'
]);

export function analyzeTypeScriptProject(project, options = {}) {
  const {
    nodeLimit = 500,
    edgeLimit = 1200,
    layers = [],
    features = []
  } = options;
  const rootPath = project.absolutePath;

  if (!fs.existsSync(rootPath)) {
    return emptyResult(`Caminho do projeto não encontrado: ${rootPath}`);
  }

  const files = findAllSourceFiles(rootPath);

  if (!files.length) {
    return emptyResult('Nenhum ficheiro .ts/.tsx/.js/.jsx encontrado');
  }

  try {
    const tsConfigPath = path.join(rootPath, 'tsconfig.json');
    const tsProject = new Project({
      tsConfigFilePath: fs.existsSync(tsConfigPath) ? tsConfigPath : undefined,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true
      }
    });

    for (const file of files) {
      tsProject.addSourceFileAtPath(file);
    }

    const nodes = [];
    const edges = [];
    const seenNodeKeys = new Set();
    const symbolsByName = new Map();
    const fileSymbolsByPath = new Map();
    const sourceFiles = tsProject.getSourceFiles().filter((sourceFile) => {
      const relativePath = normalizeRelativePath(rootPath, sourceFile.getFilePath());
      return !shouldIgnorePath(relativePath);
    });

    for (const sourceFile of sourceFiles) {
      const relativePath = normalizeRelativePath(rootPath, sourceFile.getFilePath());
      extractSymbols(sourceFile, relativePath, {
        nodes,
        seenNodeKeys,
        symbolsByName,
        fileSymbolsByPath
      });
    }

    for (const sourceFile of sourceFiles) {
      const relativePath = normalizeRelativePath(rootPath, sourceFile.getFilePath());
      extractImportEdges(sourceFile, relativePath, {
        edges,
        symbolsByName,
        fileSymbolsByPath
      });
    }

    const filteredNodes = filterNodes(nodes, { layers, features });
    const allowedNodeIds = new Set(filteredNodes.map((node) => node.id));
    const limitedNodes = filteredNodes.slice(0, nodeLimit);
    const limitedNodeIds = new Set(limitedNodes.map((node) => node.id));
    const limitedEdges = uniqueEdges(edges)
      .filter((edge) => allowedNodeIds.has(edge.from) && allowedNodeIds.has(edge.to))
      .filter((edge) => limitedNodeIds.has(edge.from) && limitedNodeIds.has(edge.to))
      .slice(0, edgeLimit);

    return {
      success: true,
      projectType: 'typescript',
      message: `Analisei ${limitedNodes.length} símbolos TypeScript`,
      nodes: limitedNodes,
      edges: limitedEdges,
      metadata: {
        totalFiles: files.length,
        totalSymbols: nodes.length,
        totalEdges: edges.length
      }
    };
  } catch (error) {
    console.error('[TypeScriptAnalyzer] Error:', error);
    return emptyResult(`Erro ao analisar: ${error.message}`);
  }
}

function emptyResult(message) {
  return {
    success: false,
    projectType: 'typescript',
    message,
    nodes: [],
    edges: []
  };
}

function findAllSourceFiles(rootPath) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = normalizeRelativePath(rootPath, fullPath);

      if (shouldIgnorePath(relativePath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(rootPath);
  return files;
}

function normalizeRelativePath(rootPath, filePath) {
  return path.relative(rootPath, filePath).replace(/\\/g, '/');
}

function shouldIgnorePath(relativePath) {
  const parts = relativePath.split(/[\\/]+/);

  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
  }

  return false;
}

function extractSymbols(sourceFile, relativePath, context) {
  const fileName = path.basename(sourceFile.getFilePath());
  const sourceText = sourceFile.getText();

  for (const declaration of sourceFile.getClasses()) {
    registerSymbol(context, relativePath, createNode({
      name: declaration.getName(),
      kind: 'class',
      relativePath,
      fileName,
      start: declaration.getStart(),
      category: classifyNode(declaration.getName(), 'class')
    }));
  }

  for (const declaration of sourceFile.getFunctions()) {
    registerSymbol(context, relativePath, createNode({
      name: declaration.getName(),
      kind: isHookName(declaration.getName()) ? 'hook' : 'function',
      relativePath,
      fileName,
      start: declaration.getStart(),
      category: classifyNode(declaration.getName(), 'function')
    }));
  }

  for (const declaration of sourceFile.getInterfaces()) {
    registerSymbol(context, relativePath, createNode({
      name: declaration.getName(),
      kind: 'interface',
      relativePath,
      fileName,
      start: declaration.getStart(),
      category: 'interface'
    }));
  }

  for (const declaration of sourceFile.getTypeAliases()) {
    registerSymbol(context, relativePath, createNode({
      name: declaration.getName(),
      kind: 'type',
      relativePath,
      fileName,
      start: declaration.getStart(),
      category: 'type'
    }));
  }

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const name = declaration.getName();

    if (!isInterestingVariableSymbol(name)) {
      continue;
    }

    registerSymbol(context, relativePath, createNode({
      name,
      kind: isHookName(name) ? 'hook' : 'component',
      relativePath,
      fileName,
      start: declaration.getStart(),
      category: classifyNode(name, 'component')
    }));
  }

  extractRegexSymbols(sourceText, relativePath, fileName, context);
}

function extractRegexSymbols(sourceText, relativePath, fileName, context) {
  const componentRegex = /(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=/g;
  const hookRegex = /(?:export\s+)?(?:function|const)\s+(use[A-Za-z0-9_]*)\s*(?:=|\()/g;
  let match;

  while ((match = componentRegex.exec(sourceText)) !== null) {
    const name = match[1];
    registerSymbol(context, relativePath, createNode({
      name,
      kind: 'component',
      relativePath,
      fileName,
      start: match.index,
      category: classifyNode(name, 'component')
    }));
  }

  while ((match = hookRegex.exec(sourceText)) !== null) {
    const name = match[1];
    registerSymbol(context, relativePath, createNode({
      name,
      kind: 'hook',
      relativePath,
      fileName,
      start: match.index,
      category: 'hook'
    }));
  }
}

function registerSymbol(context, relativePath, node) {
  if (!node?.label) return;

  const key = `${relativePath}:${node.label}`;

  if (context.seenNodeKeys.has(key)) {
    return;
  }

  context.seenNodeKeys.add(key);
  context.nodes.push(node);

  if (!context.symbolsByName.has(node.label)) {
    context.symbolsByName.set(node.label, []);
  }
  context.symbolsByName.get(node.label).push(node);

  if (!context.fileSymbolsByPath.has(relativePath)) {
    context.fileSymbolsByPath.set(relativePath, []);
  }
  context.fileSymbolsByPath.get(relativePath).push(node);
}

function extractImportEdges(sourceFile, relativePath, context) {
  const sourceSymbols = context.fileSymbolsByPath.get(relativePath) || [];

  if (!sourceSymbols.length) return;

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();

    if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
      continue;
    }

    for (const element of importDeclaration.getNamedImports()) {
      const importName = element.getName();
      const targetSymbols = context.symbolsByName.get(importName) || [];
      addImportEdges(context.edges, sourceSymbols, targetSymbols, importName, 'importa');
    }

    const defaultImport = importDeclaration.getDefaultImport();
    if (defaultImport) {
      const importName = defaultImport.getText();
      const targetSymbols = context.symbolsByName.get(importName) || [];
      addImportEdges(context.edges, sourceSymbols, targetSymbols, importName, 'importa default');
    }
  }
}

function addImportEdges(edges, sourceSymbols, targetSymbols, importName, label) {
  for (const sourceSymbol of sourceSymbols) {
    for (const targetSymbol of targetSymbols) {
      if (sourceSymbol.id === targetSymbol.id) continue;

      edges.push({
        id: `ts-edge-${sourceSymbol.id}-${targetSymbol.id}-${simpleHash(importName)}`,
        from: sourceSymbol.id,
        to: targetSymbol.id,
        relation: 'imports',
        label
      });
    }
  }
}

function createNode({ name, kind, relativePath, fileName, start, category }) {
  if (!name) return null;

  const hash = simpleHash(`${relativePath}:${name}`);

  return {
    id: `ts-${hash}`,
    label: name,
    kind,
    category,
    namespace: path.dirname(relativePath),
    projectName: null,
    layer: inferLayer(relativePath),
    feature: inferFeature(relativePath),
    file: relativePath,
    subtitle: `${fileName}:${start || 0}`
  };
}

function classifyNode(name = '', kind) {
  if (isHookName(name) || kind === 'hook') return 'hook';
  if (name.endsWith('Provider')) return 'provider';
  if (name.endsWith('Context')) return 'context';
  if (name.endsWith('Service')) return 'service';
  if (name.endsWith('Component') || kind === 'component' || /^[A-Z]/.test(name)) return 'component';

  return 'symbol';
}

function isInterestingVariableSymbol(name) {
  return /^[A-Z][A-Za-z0-9_]*$/.test(name) || isHookName(name) || name.endsWith('Provider');
}

function isHookName(name = '') {
  return /^use[A-Z0-9_]/.test(name);
}

function inferLayer(relativePath) {
  const pathLower = `/${relativePath.toLowerCase()}`;

  if (pathLower.includes('/components/')) return 'presentation';
  if (pathLower.includes('/hooks/')) return 'logic';
  if (pathLower.includes('/utils/') || pathLower.includes('/lib/')) return 'common';
  if (pathLower.includes('/services/') || pathLower.includes('/api/')) return 'services';
  if (pathLower.includes('/types/') || pathLower.includes('/interfaces/')) return 'types';

  return 'unknown';
}

function inferFeature(relativePath) {
  const parts = relativePath.split('/');
  const commonDirs = new Set(['src', 'app', 'pages', 'components', 'hooks', 'utils', 'lib', 'types', 'features']);

  for (const part of parts) {
    if (part.includes('.')) continue;
    if (!commonDirs.has(part.toLowerCase())) {
      return part;
    }
  }

  return 'shared';
}

function filterNodes(nodes, { layers = [], features = [] }) {
  const layerFilter = new Set(layers.filter((item) => item && item !== '__none__'));
  const featureFilter = new Set(features.filter((item) => item && item !== '__none__'));

  return nodes.filter((node) => {
    if (layers.includes('__none__')) return false;
    if (features.includes('__none__')) return false;
    if (layerFilter.size && !layerFilter.has(node.layer)) return false;
    if (featureFilter.size && !featureFilter.has(node.feature)) return false;
    return true;
  });
}

function uniqueEdges(edges) {
  const seen = new Set();
  const unique = [];

  for (const edge of edges) {
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);
    unique.push(edge);
  }

  return unique;
}

function simpleHash(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16);
}

export function searchSymbols(result, query) {
  if (!result.success) {
    return {
      success: false,
      message: result.message,
      nodes: [],
      edges: []
    };
  }

  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      success: true,
      message: 'Escreve um símbolo para pesquisar',
      nodes: [],
      edges: []
    };
  }

  const matches = result.nodes.filter((node) =>
    node.label.toLowerCase().includes(q) ||
    node.kind.toLowerCase().includes(q) ||
    node.category.toLowerCase().includes(q) ||
    node.file.toLowerCase().includes(q)
  ).slice(0, 20);

  return {
    success: true,
    message: `Encontrei ${matches.length} símbolos com "${query}"`,
    nodes: matches,
    edges: [],
    projectType: 'typescript'
  };
}

export function expandNode(result, nodeId, direction = 'both') {
  if (!result.success) {
    return {
      success: false,
      message: result.message,
      nodes: [],
      edges: []
    };
  }

  const target = result.nodes.find((node) => node.id === nodeId);

  if (!target) {
    return {
      success: false,
      message: 'Nó não encontrado',
      nodes: [],
      edges: []
    };
  }

  const outgoing = result.edges.filter((edge) => edge.from === nodeId);
  const incoming = result.edges.filter((edge) => edge.to === nodeId);
  const selectedEdges = direction === 'both'
    ? [...outgoing, ...incoming]
    : direction === 'out'
      ? outgoing
      : incoming;
  const nodeIds = new Set([nodeId]);

  for (const edge of selectedEdges) {
    nodeIds.add(edge.from);
    nodeIds.add(edge.to);
  }

  return {
    success: true,
    message: `${target.label}: ${outgoing.length} dependências, ${incoming.length} referências`,
    nodes: result.nodes.filter((node) => nodeIds.has(node.id)),
    edges: selectedEdges,
    projectType: 'typescript'
  };
}
