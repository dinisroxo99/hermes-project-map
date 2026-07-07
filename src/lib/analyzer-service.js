/**
 * Analyzer Service — multi-project type analysis dispatcher
 *
 * Detects project type and delegates to the appropriate analyzer.
 * Fallback to .NET analyzer for existing .NET projects.
 */

import { detectProjectType } from '../analyzers/common/analyzer-detection.js';
import { analyzeDotNetProject } from '../analyzers/dotnet/dotnet-analyzer.js';
import { analyzeTypeScriptProject, searchSymbols as tsSearch, expandNode as tsExpand } from '../analyzers/typescript/typescript-analyzer.js';

/**
 * Analysis options
 * @typedef {Object} AnalysisOptions
 * @property {number} [nodeLimit=500] - Maximum nodes to return
 * @property {number} [edgeLimit=1200] - Maximum edges to return
 * @property {string[]} [layers] - Filter by layers
 * @property {string[]} [features] - Filter by features
 */

/**
 * Analyze a project based on its detected type
 * @param {object} project - Project object from projects.js
 * @param {AnalysisOptions} [options] - Analysis options
 * @returns {object} Analysis result
 */
export function analyzeProject(project, options = {}) {
  const projectType = detectProjectType(project.absolutePath);

  if (projectType === 'dotnet') {
    return analyzeDotNetProject(project, options);
  }
  
  if (projectType === 'typescript') {
    return analyzeTypeScriptProject(project, options);
  }

  // Fallback: treat as unknown/unanalyzable
  return {
    success: false,
    projectType,
    message: `Tipo de projeto não suportado: ${projectType}`,
    nodes: [],
    edges: []
  };
}

/**
 * Search symbols across project types
 * @param {object} project - Project object
 * @param {string} query - Search query
 * @returns {object} Search result
 */
export function searchSymbols(project, query) {
  const projectType = detectProjectType(project.absolutePath);

  if (projectType === 'dotnet') {
    return analyzeDotNetProject(project).search?.(query) || {
      success: false,
      message: 'Busca não disponível para .NET neste momento'
    };
  }
  
  if (projectType === 'typescript') {
    const analysis = analyzeTypeScriptProject(project);
    return tsSearch(analysis, query);
  }

  return {
    success: false,
    projectType,
    message: `Busca não suportada para tipo: ${projectType}`,
    results: []
  };
}

/**
 * Expand a node (symbol) to show dependencies/references
 * @param {object} project - Project object
 * @param {string} nodeId - Node/symbol ID to expand
 * @param {'both'|'in'|'out'} direction - Direction of expansion
 * @returns {object} Expansion result
 */
export function expandNode(project, nodeId, direction = 'both') {
  const projectType = detectProjectType(project.absolutePath);

  if (projectType === 'dotnet') {
    return analyzeDotNetProject(project).expand?.(nodeId, direction) || {
      success: false,
      message: 'Expand não disponível para .NET neste momento'
    };
  }
  
  if (projectType === 'typescript') {
    const analysis = analyzeTypeScriptProject(project);
    return tsExpand(analysis, nodeId, direction);
  }

  return {
    success: false,
    projectType,
    message: `Expand não suportado para tipo: ${projectType}`,
    node: null,
    dependencies: []
  };
}