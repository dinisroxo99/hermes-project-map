import path from "node:path";
import { findFiles, readText, relative } from "../utils/fs-utils.js";

const LAYER_ORDER = ["API", "Application", "Domain", "Infrastructure", "Tests", "Other"];

const ARCHITECTURE_SEGMENTS = new Set([
  "api",
  "application",
  "domain",
  "infrastructure",
  "core",
  "shared",
  "common",
  "services",
  "service",
  "handlers",
  "handler",
  "commands",
  "command",
  "queries",
  "query",
  "controllers",
  "controller",
  "endpoints",
  "endpoint",
  "models",
  "model",
  "entities",
  "entity",
  "dtos",
  "dto",
  "contracts",
  "contract",
  "interfaces",
  "interface",
  "persistence",
  "repositories",
  "repository",
  "database",
  "dbcontext",
  "configurations",
  "configuration",
  "config",
  "migrations",
  "mapping",
  "mappers",
  "mapper",
  "options",
  "validators",
  "validator",
  "validation",
  "extensions",
  "extension",
  "middleware",
  "middlewares",
  "exceptions",
  "exception",
  "constants",
  "constant",
  "enums",
  "enum",
  "properties",
  "bin",
  "obj"
]);

/**
 * Builds a structural summary for a loaded .NET project or solution.
 * @param {{name:string, absolutePath:string}} project
 */
export function analyzeProjectStructure(project) {
  const slnFiles = [
    ...findFiles(project.absolutePath, ".sln"),
    ...findFiles(project.absolutePath, ".slnx")
  ].sort();
  const csprojFiles = findFiles(project.absolutePath, ".csproj").sort();
  const csFiles = findFiles(project.absolutePath, ".cs").sort();

  const projects = csprojFiles.map((file) => {
    const name = path.basename(file, ".csproj");
    const layer = inferLayerFromProjectName(name);

    return {
      name,
      layer,
      path: relative(project.absolutePath, file),
      directory: relative(project.absolutePath, path.dirname(file)),
      csFileCount: 0,
      featureCount: 0
    };
  }).sort(compareProjects);

  const projectDirs = projects
    .map((item) => ({
      ...item,
      absoluteDir: path.join(project.absolutePath, item.directory)
    }))
    .sort((a, b) => b.absoluteDir.length - a.absoluteDir.length);

  const projectByName = new Map(projects.map((item) => [item.name, item]));
  const featureMap = new Map();

  for (const file of csFiles) {
    const projectInfo = findNearestProject(file, projectDirs);
    const content = readText(file);
    const namespace = extractNamespace(content);
    const symbolLike = {
      projectName: projectInfo?.name || "unknown",
      layer: projectInfo?.layer || "Other",
      relativeFile: relative(project.absolutePath, file),
      namespace,
      name: path.basename(file, ".cs")
    };
    const featureName = inferFeatureFromSymbol(symbolLike);

    if (projectInfo && projectByName.has(projectInfo.name)) {
      projectByName.get(projectInfo.name).csFileCount += 1;
    }

    if (!featureName) {
      continue;
    }

    if (!featureMap.has(featureName)) {
      featureMap.set(featureName, {
        name: featureName,
        symbolCount: 0,
        projectNames: new Set(),
        layers: new Set()
      });
    }

    const feature = featureMap.get(featureName);
    feature.symbolCount += 1;

    if (projectInfo) {
      feature.projectNames.add(projectInfo.name);
      feature.layers.add(projectInfo.layer);
    }
  }

  for (const projectInfo of projects) {
    projectInfo.featureCount = Array.from(featureMap.values()).filter((feature) => {
      return feature.projectNames.has(projectInfo.name);
    }).length;
  }

  const layers = LAYER_ORDER
    .map((layer) => {
      const layerProjects = projects.filter((item) => item.layer === layer);
      if (!layerProjects.length) return null;

      return {
        name: layer,
        projectCount: layerProjects.length,
        projects: layerProjects.map((item) => item.name),
        csFileCount: layerProjects.reduce((sum, item) => sum + item.csFileCount, 0)
      };
    })
    .filter(Boolean);

  const features = Array.from(featureMap.values())
    .map((feature) => ({
      name: feature.name,
      symbolCount: feature.symbolCount,
      projectNames: Array.from(feature.projectNames).sort(),
      layers: Array.from(feature.layers).sort(compareLayerNames)
    }))
    .sort((a, b) => b.symbolCount - a.symbolCount || a.name.localeCompare(b.name));

  return {
    project: project.name,
    rootPath: project.absolutePath,
    solution: {
      name: slnFiles.length ? path.basename(slnFiles[0]).replace(/\.slnx?$/, "") : project.name,
      path: slnFiles.length ? relative(project.absolutePath, slnFiles[0]) : null,
      count: slnFiles.length
    },
    projects,
    layers,
    features,
    canSubdivide: projects.length > 1 || features.length > 1,
    suggestedModes: buildSuggestedModes(projects, features)
  };
}

export function inferLayerFromProjectName(projectName) {
  const name = String(projectName || "").toLowerCase();

  if (/(^|[._-])(api|webapi|web)([._-]|$)/.test(name) || name.endsWith(".api")) return "API";
  if (/(^|[._-])application([._-]|$)/.test(name) || name.endsWith(".application")) return "Application";
  if (/(^|[._-])domain([._-]|$)/.test(name) || name.endsWith(".domain")) return "Domain";
  if (/(^|[._-])infrastructure([._-]|$)/.test(name) || name.endsWith(".infrastructure")) return "Infrastructure";
  if (/(^|[._-])(test|tests)([._-]|$)/.test(name) || name.endsWith(".tests")) return "Tests";

  return "Other";
}

/**
 * Infers a business feature from a symbol's path/namespace.
 * @param {{projectName?:string, layer?:string, relativeFile?:string, namespace?:string, name?:string}} symbol
 */
export function inferFeatureFromSymbol(symbol) {
  const projectName = symbol.projectName || "";
  const layer = symbol.layer || inferLayerFromProjectName(projectName);
  const pathSegments = String(symbol.relativeFile || "")
    .split(/[\\/]/)
    .filter(Boolean);

  const projectRootIndex = pathSegments.findIndex((segment) => segment === projectName);
  const scopedPathSegments = projectRootIndex >= 0
    ? pathSegments.slice(projectRootIndex + 1, -1)
    : pathSegments.slice(0, -1);

  const fromPath = firstBusinessSegment(scopedPathSegments, layer);
  if (fromPath) return fromPath;

  const nsSegments = String(symbol.namespace || "")
    .split(".")
    .filter(Boolean)
    .filter((segment) => !isProjectNameSegment(segment, projectName));

  const fromNamespace = firstBusinessSegment(nsSegments, layer);
  if (fromNamespace) return fromNamespace;

  return inferFeatureFromName(symbol.name || "");
}

function buildSuggestedModes(projects, features) {
  const modes = ["all"];

  if (projects.length > 1) {
    modes.push("project", "layer");
  }

  if (features.length > 1) {
    modes.push("feature");
  }

  return modes;
}

function firstBusinessSegment(segments, layer) {
  for (const segment of segments) {
    const cleaned = cleanSegment(segment);
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (ARCHITECTURE_SEGMENTS.has(key)) continue;
    if (key === String(layer || "").toLowerCase()) continue;
    if (/^[a-z]:$/i.test(cleaned)) continue;

    return cleaned;
  }

  return null;
}

function inferFeatureFromName(name) {
  const match = String(name || "").match(/^([A-Z][a-zA-Z0-9]*?)(Controller|Service|Handler|Repository|Command|Query|Dto|Request|Response|Entity|Client)?$/);
  if (!match) return null;

  const prefix = match[1]
    .replace(/(Creation|Create|Update|Delete|Get|List|Sync|Processor|Manager)$/i, "")
    .replace(/^I(?=[A-Z])/, "");

  if (!prefix || prefix.length < 3) return null;

  return cleanSegment(prefix);
}

function cleanSegment(segment) {
  const value = String(segment || "")
    .replace(/\.cs$/i, "")
    .replace(/\.csproj$/i, "")
    .trim();

  if (!value) return null;

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isProjectNameSegment(segment, projectName) {
  const parts = String(projectName || "").split(/[._-]/).filter(Boolean);
  return parts.some((part) => part.toLowerCase() === String(segment || "").toLowerCase());
}

function findNearestProject(file, projectDirs) {
  for (const projectInfo of projectDirs) {
    if (file.startsWith(projectInfo.absoluteDir)) {
      return projectInfo;
    }
  }

  return null;
}

function extractNamespace(content) {
  const fileScoped = content.match(/\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/);
  if (fileScoped) return fileScoped[1];

  const blockScoped = content.match(/\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*\{/);
  if (blockScoped) return blockScoped[1];

  return "";
}

function compareProjects(a, b) {
  const layerCompare = compareLayerNames(a.layer, b.layer);
  if (layerCompare !== 0) return layerCompare;
  return a.name.localeCompare(b.name);
}

function compareLayerNames(a, b) {
  const ai = LAYER_ORDER.indexOf(a);
  const bi = LAYER_ORDER.indexOf(b);
  const ap = ai === -1 ? LAYER_ORDER.length : ai;
  const bp = bi === -1 ? LAYER_ORDER.length : bi;
  return ap - bp || String(a).localeCompare(String(b));
}
