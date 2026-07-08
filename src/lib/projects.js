import fs from "node:fs";
import path from "node:path";
import {
  detectProjectType,
  getProjectTypeLabel,
  isSupportedProjectType
} from "../analyzers/common/analyzer-detection.js";

const REPO_ROOT = process.cwd();
const ENV_FILE_VALUES = readEnvFile(path.join(REPO_ROOT, ".env"));
const DATA_DIR = process.env.DATA_DIR || ENV_FILE_VALUES.DATA_DIR || path.join(REPO_ROOT, "data");
const PROJECTS_ROOT_CONTAINER = process.env.PROJECTS_ROOT_CONTAINER
  || ENV_FILE_VALUES.PROJECTS_ROOT_CONTAINER
  || toRuntimePath(ENV_FILE_VALUES.PROJECTS_ROOT)
  || "/projects";

const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(envPath, "utf8").split(String.fromCharCode(10));

  for (const line of lines) {
    const trimmed = line.replace(/\r$/, "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, "");
    values[key] = value;
  }

  return values;
}

function toRuntimePath(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(/\\/g, "/");
  const windowsDriveMatch = normalized.match(/^([a-zA-Z]):\/(.*)$/);

  if (process.platform === "linux" && windowsDriveMatch) {
    return `/mnt/${windowsDriveMatch[1].toLowerCase()}/${windowsDriveMatch[2]}`;
  }

  return normalized;
}

function readProjectsFile() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return [];
  }

  const raw = fs.readFileSync(PROJECTS_FILE, "utf8").trim();

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map(normalizeProjectEntry)
    .filter(Boolean);
}

function normalizeProjectEntry(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return null;
  }

  const name = typeof project.name === "string" ? project.name.trim() : "";
  const relativePath = normalizeRelativePath(project.relativePath);

  if (!name || !relativePath) {
    return null;
  }

  return {
    ...project,
    name,
    relativePath
  };
}

function normalizeRelativePath(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!normalized || normalized.split("/").includes("..")) {
    return null;
  }

  return normalized;
}

export function getProjectAbsolutePath(project) {
  return path.join(PROJECTS_ROOT_CONTAINER, project.relativePath || "");
}

export function getProjectByName(name) {
  const projects = readProjectsFile();
  const project = projects.find((item) => item.name === name);

  if (!project) {
    throw new Error(`Projeto não encontrado: ${name}`);
  }

  const absolutePath = getProjectAbsolutePath(project);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Pasta do projeto não encontrada no runtime: ${absolutePath}`);
  }

  return {
    ...project,
    absolutePath
  };
}

export function listProjects() {
  return readProjectsFile().map((project) => ({
    ...project,
    absolutePath: getProjectAbsolutePath(project)
  }));
}

export function listProjectSummaries() {
  return listProjects().map((project) => {
    const exists = fs.existsSync(project.absolutePath);
    const projectType = exists ? detectProjectType(project.absolutePath) : "unknown";
    const tsFileCount = exists ? countFiles(project.absolutePath, [".ts"]) : 0;
    const tsxFileCount = exists ? countFiles(project.absolutePath, [".tsx"]) : 0;
    const jsFileCount = exists ? countFiles(project.absolutePath, [".js"]) : 0;
    const jsxFileCount = exists ? countFiles(project.absolutePath, [".jsx"]) : 0;

    return {
      name: project.name,
      relativePath: project.relativePath,
      absolutePath: project.absolutePath,
      addedAt: project.addedAt,
      exists,
      projectType,
      typeLabel: getProjectTypeLabel(projectType),
      supported: isSupportedProjectType(projectType),
      csprojCount: exists ? countFiles(project.absolutePath, [".csproj"]) : 0,
      slnCount: exists ? countFiles(project.absolutePath, [".sln", ".slnx"]) : 0,
      tsFileCount,
      tsxFileCount,
      jsFileCount,
      jsxFileCount,
      sourceFileCount: tsFileCount + tsxFileCount + jsFileCount + jsxFileCount
    };
  });
}

function countFiles(root, extensions) {
  let count = 0;
  const wanted = new Set(extensions.map((extension) => extension.toLowerCase()));

  for (const file of walk(root)) {
    if (wanted.has(path.extname(file).toLowerCase())) {
      count += 1;
    }
  }

  return count;
}

function* walk(dir) {
  const ignored = new Set([
    "bin",
    "obj",
    ".git",
    ".vs",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage"
  ]);

  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignored.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}
