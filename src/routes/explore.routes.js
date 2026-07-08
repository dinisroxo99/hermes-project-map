/**
 * Explore routes — search, expand, full graph
 *
 * GET /api/explore/:project/search?q=...
 * GET /api/explore/:project/expand?nodeId=...&direction=both|in|out
 * GET /api/explore/:project/full?nodeLimit=500&edgeLimit=1200
 */

import { getProjectByName } from "../lib/projects.js";
import {
  searchSymbols,
  expandNode,
  analyzeProject
} from "../lib/analyzer-service.js";
import { sendOk, sendError } from "../utils/response.js";
import {
  validateProjectName,
  validateNodeId,
  validateSearchQuery,
  parseLimit
} from "../utils/validation.js";

// Fallback import para .NET (retrocompatibilidade)
import { getFullGraphExplorer as getFullGraphDotNet } from "../lib/symbol-index.js";

/**
 * Resolves and validates a project.
 * Returns the project object or sends an error response and returns null.
 * Catches exceptions from getProjectByName (project not found, path missing)
 * and converts them to proper HTTP error codes.
 * @param {import('node:http').ServerResponse} res
 * @param {string} projectName
 * @returns {{ project: object | null }}
 */
function resolveProject(res, projectName) {
  const v = validateProjectName(projectName);
  if (!v.valid) {
    sendError(res, 400, "invalid_project", v.error);
    return { project: null };
  }

  try {
    const project = getProjectByName(projectName);
    return { project };
  } catch (err) {
    const msg = err.message || `Projeto "${projectName}" não disponível.`;

    if (msg.includes("não encontrado")) {
      sendError(res, 404, "not_found", msg);
    } else {
      sendError(res, 502, "project_unavailable", msg);
    }

    return { project: null };
  }
}

/**
 * GET /api/explore/:project/search?q=...
 */
export async function handleSearch(req, res, params, query) {
  const { project } = resolveProject(res, params.project);
  if (!project) return;

  const q = query.get("q") || "";

  const vq = validateSearchQuery(q);
  if (!vq.valid) {
    sendError(res, 400, "invalid_query", vq.error);
    return;
  }

  const result = searchSymbols(project, q);
  sendOk(res, 200, result, result.message || "Busca concluída");
}

/**
 * GET /api/explore/:project/expand?nodeId=...&direction=both|in|out
 */
export async function handleExpand(req, res, params, query) {
  const { project } = resolveProject(res, params.project);
  if (!project) return;

  const nodeId = query.get("nodeId") || "";

  const vn = validateNodeId(nodeId);
  if (!vn.valid) {
    sendError(res, 400, "invalid_node", vn.error);
    return;
  }

  const direction = query.get("direction") || "both";

  if (!["both", "in", "out"].includes(direction)) {
    sendError(res, 400, "invalid_direction", "Direction deve ser 'both', 'in' ou 'out'.");
    return;
  }

  const result = expandNode(project, nodeId, direction);
  sendOk(res, 200, result, result.message || "Expansão concluída");
}

/**
 * GET /api/explore/:project/full?nodeLimit=500&edgeLimit=1200
 */
export async function handleFullGraph(req, res, params, query) {
  const { project } = resolveProject(res, params.project);
  if (!project) return;

  const nodeLimit = parseLimit(query.get("nodeLimit"), 500, 1, 5000);
  const edgeLimit = parseLimit(query.get("edgeLimit"), 1200, 1, 10000);
  const layers = parseCsv(query.get("layers"));
  const features = parseCsv(query.get("features"));

  let result;

  try {
    const analysis = analyzeProject(project, { nodeLimit, edgeLimit, layers, features });

    if (typeof analysis.fullGraph === "function") {
      result = analysis.fullGraph({ nodeLimit, edgeLimit, layers, features });
    } else {
      result = analysis;
    }
  } catch (err) {
    result = getFullGraphDotNet(project, { nodeLimit, edgeLimit, layers, features });
  }

  sendOk(res, 200, result, result.message || "Grafo completo carregado");
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
