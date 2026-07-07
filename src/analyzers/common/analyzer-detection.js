/**
 * Project type detection
 *
 * Detects the type of project based on files present in the root.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Supported project types
 * @typedef {'dotnet'|'nodejs'|'typescript'|'python'|'unknown'} ProjectType
 */

/**
 * Detect project type by inspecting files in the project root
 * @param {string} absolutePath - Absolute path to project root
 * @returns {ProjectType} Detected project type
 */
export function detectProjectType(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return 'unknown';
  }

  const files = fs.readdirSync(absolutePath);
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  // .NET detection
  const hasCsproj = files.some(f => f.toLowerCase().endsWith('.csproj'));
  const hasSln = files.some(f => f.toLowerCase().endsWith('.sln'));
  const hasDotnetProps = fileSet.has(' Directory.Build.props') || fileSet.has('directory.build.props');
  
  if (hasCsproj || hasSln || hasDotnetProps) {
    return 'dotnet';
  }

  // Node.js detection
  const hasPackageJson = fileSet.has('package.json');
  const hasNodeModules = fileSet.has('node_modules');
  const hasJsFiles = files.some(f => f.endsWith('.js') && !f.startsWith('.'));

  if (hasPackageJson && (hasJsFiles || hasNodeModules)) {
    // Distinguish between plain Node.js and TypeScript
    const hasTsConfig = fileSet.has('tsconfig.json');
    const hasTsFiles = files.some(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));

    if (hasTsConfig || hasTsFiles) {
      return 'typescript';
    }

    return 'nodejs';
  }

  // Python detection
  const hasPyProjectToml = fileSet.has('pyproject.toml');
  const hasSetupPy = fileSet.has('setup.py');
  const hasRequireTxt = fileSet.has('requirements.txt');
  const hasPyFiles = files.some(f => f.endsWith('.py'));

  if ((hasPyProjectToml || hasSetupPy || hasRequireTxt) && hasPyFiles) {
    return 'python';
  }

  return 'unknown';
}

/**
 * Get a human-readable label for the project type
 * @param {ProjectType} type
 * @returns {string}
 */
export function getProjectTypeLabel(type) {
  const labels = {
    dotnet: '.NET (C#)',
    nodejs: 'Node.js',
    typescript: 'TypeScript',
    python: 'Python',
    unknown: 'Desconhecido'
  };

  return labels[type] || type;
}

/**
 * Check if a project type is currently supported for analysis
 * @param {ProjectType} type
 * @returns {boolean}
 */
export function isSupportedProjectType(type) {
  return type === 'dotnet' || type === 'typescript';
}