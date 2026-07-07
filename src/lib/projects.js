import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const PROJECTS_ROOT_CONTAINER = process.env.PROJECTS_ROOT_CONTAINER || "/projects";

const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

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

  return parsed;
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
    throw new Error(`Pasta do projeto não encontrada no container: ${absolutePath}`);
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

    return {
      name: project.name,
      relativePath: project.relativePath,
      absolutePath: project.absolutePath,
      addedAt: project.addedAt,
      exists,
      csprojCount: exists ? countFiles(project.absolutePath, ".csproj") : 0,
      slnCount: exists ? countFiles(project.absolutePath, ".sln") : 0
    };
  });
}

function countFiles(root, extension) {
  let count = 0;

  for (const file of walk(root)) {
    if (file.toLowerCase().endsWith(extension)) {
      count += 1;
    }
  }

  return count;
}

function* walk(dir) {
  const ignored = new Set(["bin", "obj", ".git", ".vs", "node_modules", ".next"]);

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