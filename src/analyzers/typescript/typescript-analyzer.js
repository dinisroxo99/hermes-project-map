/**
 * TypeScript Analyzer
 *
 * Analyzes TypeScript/JavaScript projects using ts-morph.
 * Extracts: imports, exports, components, hooks, providers, types/interfaces.
 */

import { Project, SyntaxKind } from 'ts-morph';
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
  const { nodeLimit = 500 } = options;
  const rootPath = project.absolutePath;

  if (!fs.existsSync(rootPath)) {
    return {
      success: false,
      projectType: 'typescript',
      message: `Caminho do projeto não encontrado: ${rootPath}`,
      nodes: [],
      edges: []
    };
  }

  if (!hasTypeScriptFiles(rootPath)) {
    return {
      success: false,
      projectType: 'typescript',
      message: 'Nenhum ficheiro .ts/.tsx encontrado',
      nodes: [],
      edges: []
    };
  }

  try {
    const tsConfigPath = path.join(rootPath, 'tsconfig.json');
    const project_morph = new Project({
      tsConfigFilePath: fs.existsSync(tsConfigPath) ? tsConfigPath : undefined,
      skipAddingFilesFromTsConfig: true
    });

    const files = findAllTsFiles(rootPath);
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        project_morph.addSourceFileAtPath(file);
      }
    }

    const nodes = [];
    const edges = [];
    const symbolMap = new Map();

    for (const sourceFile of project_morph.getSourceFiles()) {
      const relativePath = path.relative(rootPath, sourceFile.getFilePath());
      
      if (shouldIgnorePath(relativePath)) continue;

      extractExports(sourceFile, relativePath, nodes, symbolMap);
      extractImports(sourceFile, symbolMap, edges);
    }

    const limitedNodes = nodes.slice(0, nodeLimit);
    const limitedNodeIds = new Set(limitedNodes.map(n => n.id));
    const limitedEdges = edges.filter(e => 
      limitedNodeIds.has(e.from) && limitedNodeIds.has(e.to)
    ).slice(0, 1200);

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
    return {
      success: false,
      projectType: 'typescript',
      message: `Erro ao analisar: ${error.message}`,
      nodes: [],
      edges: []
    };
  }
}

function hasTypeScriptFiles(rootPath) {
  const files = findAllTsFiles(rootPath);
  return files.length > 0;
}

function findAllTsFiles(rootPath) {
  const files = [];
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootPath, fullPath);
      
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

function shouldIgnorePath(relativePath) {
  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
  }
  return false;
}

function extractExports(sourceFile, relativePath, nodes, symbolMap) {
  const fileName = path.basename(sourceFile.getFilePath());
  const sourceText = sourceFile.getText();

  // Classes
  for (const declaration of sourceFile.getClasses()) {
    const name = declaration.getName();
    if (!name) continue;
    
    const node = createNode({
      name,
      kind: 'class',
      relativePath,
      fileName,
      start: declaration.getStart(),
      category: classifyNode(name, 'class')
    });
    
    nodes.push(node);
    symbolMap.set(name, node);
  }

  // Exported functions
  for (const declaration of sourceFile.getExportedDeclarations().values()) {
    for (const decl of Array.isArray(declaration) ? declaration : [declaration]) {
      const name = decl.getName?.();
      if (!name) continue;
      
      const kind = decl.getKindName?.().toLowerCase() || 'symbol';
      const start = decl.getStart?.() || 0;
      
      let category = 'symbol';
      if (kind.includes('class')) category = classifyNode(name, 'class');
      else if (kind.includes('function')) category = classifyNode(name, 'function');
      else if (kind.includes('interface')) category = 'interface';
      else if (kind.includes('type')) category = 'type';

      if (!symbolMap.has(name)) {
        const node = createNode({
          name,
          kind: kind.replace('Declaration', '').toLowerCase(),
          relativePath,
          fileName,
          start,
          category
        });
        
        nodes.push(node);
        symbolMap.set(name, node);
      }
    }
  }

  // React Components (capitalized function/constants)
  const componentRegex = /const\s+([A-Z][a-zA-Z0-9_]*)\s*=/g;
  let match;
  
  while ((match = componentRegex.exec(sourceText)) !== null) {
    const name = match[1];
    
    if (!symbolMap.has(name)) {
      const node = createNode({
        name,
        kind: 'component',
        relativePath,
        fileName,
        start: match.index,
        category: 'component'
      });
      
      nodes.push(node);
      symbolMap.set(name, node);
    }
  }

  // Hooks (use* functions)
  const hookRegex = /export\s+function\s+(use[A-Za-z0-9_]*)\s*\(/g;
  
  while ((match = hookRegex.exec(sourceText)) !== null) {
    const name = match[1];
    
    if (!symbolMap.has(name)) {
      const node = createNode({
        name,
        kind: 'hook',
        relativePath,
        fileName,
        start: match.index,
        category: 'hook'
      });
      
      nodes.push(node);
      symbolMap.set(name, node);
    }
  }
}

function extractImports(sourceFile, symbolMap, edges) {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
    
    // Only internal imports (start with . or /)
    if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
      continue;
    }
    
    const namedImports = importDeclaration.getNamedBindings();
    
    if (namedImports && 'getElements' in namedImports) {
      for (const element of namedImports.getElements()) {
        const importName = element.getName();
        const importedSymbol = symbolMap.get(importName);
        
        if (importedSymbol) {
          edges.push({
            id: `${sourceFile.getFilePath()}:${importName}`,
            from: importedSymbol.id,
            to: importedSymbol.id,
            relation: 'imports',
            label: 'importa'
          });
        }
      }
    }
    
    if (importDeclaration.hasNamespaceImport()) {
      const namespaceImport = importDeclaration.getNamespaceImport();
      const importName = namespaceImport.getName();
      const importedSymbol = symbolMap.get(importName);
      
      if (importedSymbol) {
        edges.push({
          id: `${sourceFile.getFilePath()}:${importName}:ns`,
          from: importedSymbol.id,
          to: importedSymbol.id,
          relation: 'imports',
          label: 'importa *'
        });
      }
    }
  }
}

function createNode({ name, kind, relativePath, fileName, start, category }) {
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
    subtitle: `${fileName}:${start || 0}`,
    _relativePath: relativePath,
    _start: start
  };
}

function classifyNode(name, kind) {
  if (kind === 'component' || name.endsWith('Component')) return 'component';
  if (kind === 'hook' || name.endsWith('Hook')) return 'hook';
  if (name.endsWith('Provider') || name.endsWith('Container')) return 'provider';
  if (name.endsWith('Service')) return 'service';
  if (name.endsWith('Context')) return 'context';
  
  return 'symbol';
}

function inferLayer(relativePath) {
  const pathLower = relativePath.toLowerCase();
  
  if (pathLower.includes('/components/')) return 'presentation';
  if (pathLower.includes('/hooks/')) return 'logic';
  if (pathLower.includes('/utils/') || pathLower.includes('/lib/')) return 'common';
  if (pathLower.includes('/services/')) return 'services';
  if (pathLower.includes('/types/') || pathLower.includes('/interfaces/')) return 'types';
  
  return 'unknown';
}

function inferFeature(relativePath) {
  const parts = relativePath.split(path.sep);
  const commonDirs = ['src', 'components', 'hooks', 'utils', 'lib', 'types', 'features'];
  
  for (const part of parts) {
    if (!commonDirs.includes(part.toLowerCase())) {
      return part;
    }
  }
  
  return 'shared';
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
  
  const matches = result.nodes.filter(n => 
    n.label.toLowerCase().includes(q) ||
    n.kind.toLowerCase().includes(q) ||
    n.category.toLowerCase().includes(q)
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
      node: null,
      dependencies: []
    };
  }
  
  const target = result.nodes.find(n => n.id === nodeId);
  
  if (!target) {
    return {
      success: false,
      message: 'Nó não encontrado',
      node: null,
      dependencies: []
    };
  }
  
  const outgoing = result.edges.filter(e => e.from === nodeId);
  const incoming = result.edges.filter(e => e.to === nodeId);
  
  return {
    success: true,
    message: `${target.label}: ${outgoing.length} dependências, ${incoming.length} referências`,
    node: target,
    dependencies: direction === 'both' ? [...outgoing, ...incoming] : 
                  direction === 'out' ? outgoing : incoming,
    projectType: 'typescript'
  };
}

export function analyzeDotNetProject(project, options = {}) {
  return analyzeTypeScriptProject(project, options);
}