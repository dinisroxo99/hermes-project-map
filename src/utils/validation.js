/**
 * Validation utilities — guard against invalid inputs and path traversal.
 */

/**
 * Validates a project name from URL path segment.
 * Must be non-empty, no path separators, no dots (except inside name).
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProjectName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Nome de projeto em falta." };
  }

  if (name.length > 200) {
    return { valid: false, error: "Nome de projeto demasiado longo." };
  }

  if (/[/\\]/.test(name)) {
    return { valid: false, error: "Nome de projeto contém caracteres inválidos." };
  }

  if (name.includes("..")) {
    return { valid: false, error: "Nome de projeto inválido." };
  }

  return { valid: true };
}

/**
 * Validates a node ID.
 * @param {string} nodeId
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNodeId(nodeId) {
  if (!nodeId || typeof nodeId !== "string") {
    return { valid: false, error: "ID de nó em falta." };
  }

  if (nodeId.length > 500) {
    return { valid: false, error: "ID de nó demasiado longo." };
  }

  return { valid: true };
}

/**
 * Parses and validates a numeric limit, clamped to [min, max].
 * @param {string|number} raw
 * @param {number} defaultValue
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function parseLimit(raw, defaultValue, min, max) {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

/**
 * Validates a search query string.
 * @param {string} query
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSearchQuery(query) {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Query de pesquisa em falta." };
  }

  if (query.length > 500) {
    return { valid: false, error: "Query de pesquisa demasiado longa." };
  }

  return { valid: true };
}

/**
 * Ensures a resolved path stays within the allowed root directory.
 * Prevents path traversal attacks.
 * @param {string} resolvedPath
 * @param {string} rootPath
 * @returns {boolean}
 */
export function isPathSafe(resolvedPath, rootPath) {
  const normalizedRoot = rootPath.replace(/[/\\]+$/, "");
  return resolvedPath === normalizedRoot || resolvedPath.startsWith(normalizedRoot + "/");
}
