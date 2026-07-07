/**
 * Filesystem utilities — shared across backend modules.
 * Shared helpers for backend filesystem operations.
 */

import fs from "node:fs";
import path from "node:path";

export const IGNORED_DIRS = new Set([
  "bin",
  "obj",
  ".git",
  ".vs",
  "node_modules",
  ".next",
  "dist",
  "build"
]);

/**
 * Recursively finds files with a given extension.
 * @param {string} root
 * @param {string} extension — e.g. ".cs"
 * @returns {string[]}
 */
export function findFiles(root, extension) {
  const results = [];

  function visit(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (fullPath.toLowerCase().endsWith(extension)) {
        results.push(fullPath);
      }
    }
  }

  visit(root);

  return results;
}

/**
 * Reads a text file, stripping null bytes. Returns "" on error.
 * @param {string} file
 * @returns {string}
 */
export function readText(file) {
  try {
    return fs.readFileSync(file, "utf8").replace(/\0/g, "");
  } catch {
    return "";
  }
}

/**
 * Returns a relative path with forward slashes.
 * @param {string} root
 * @param {string} file
 * @returns {string}
 */
export function relative(root, file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

/**
 * Normalises path separators to forward slashes.
 * @param {string} file
 * @returns {string}
 */
export function normalizePath(file) {
  return file.replaceAll("\\", "/");
}
