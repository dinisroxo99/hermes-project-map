import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const DATA_DIR = process.env.DATA_DIR || "/app/data";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function run(command) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], {
      cwd: "/app",
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
  });
}

export async function runScipIndex(project) {
  const src = project.absolutePath;
  const workDir = `/tmp/hermes-dotnet-map/${project.name}`;
  const outDir = path.join(DATA_DIR, "indexes", project.name);

  fs.mkdirSync(outDir, { recursive: true });

  const command = [
    `rm -rf ${shellQuote(workDir)}`,
    `mkdir -p ${shellQuote(workDir)}`,
    `cp -a ${shellQuote(src)}/. ${shellQuote(workDir)}/`,
    `cd ${shellQuote(workDir)}`,
    "dotnet restore",
    "scip-dotnet index",
    `mkdir -p ${shellQuote(outDir)}`,
    `cp index.scip ${shellQuote(path.join(outDir, "index.scip"))}`
  ].join(" && ");

  const startedAt = new Date().toISOString();
  const result = await run(command);
  const finishedAt = new Date().toISOString();

  return {
    project: project.name,
    ok: result.code === 0,
    startedAt,
    finishedAt,
    indexPath: `/app/data/indexes/${project.name}/index.scip`,
    stdout: result.stdout.slice(-8000),
    stderr: result.stderr.slice(-8000)
  };
}