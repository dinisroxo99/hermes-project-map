/**
 * Projects routes — GET /api/projects, GET /api/health
 */

import { listProjectSummaries, getProjectByName } from "../lib/projects.js";
import { analyzeProjectStructure } from "../lib/project-structure.js";
import { sendOk, sendError } from "../utils/response.js";
import { validateProjectName } from "../utils/validation.js";

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {Record<string,string>} _params
 * @param {URLSearchParams} _query
 */
export async function handleListProjects(req, res, _params, _query) {
  const projects = listProjectSummaries();
  sendOk(res, 200, { projects });
}

/**
 * GET /api/health — simple health check for Docker
 */
export async function handleHealth(req, res) {
  sendOk(res, 200, {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

/**
 * GET /api/projects/:name — get single project details
 */
export async function handleGetProject(req, res, params) {
  const v = validateProjectName(params.name);
  if (!v.valid) {
    sendError(res, 400, "invalid_project", v.error);
    return;
  }

  try {
    const project = getProjectByName(params.name);
    sendOk(res, 200, project);
  } catch (err) {
    const msg = err.message || `Projeto "${params.name}" não disponível.`;

    if (msg.includes("não encontrado")) {
      sendError(res, 404, "not_found", msg);
    } else {
      sendError(res, 502, "project_unavailable", msg);
    }
  }
}

/**
 * GET /api/projects/:name/structure — solution/projects/layers/features summary
 */
export async function handleGetProjectStructure(req, res, params) {
  const v = validateProjectName(params.name);
  if (!v.valid) {
    sendError(res, 400, "invalid_project", v.error);
    return;
  }

  try {
    const project = getProjectByName(params.name);
    const structure = analyzeProjectStructure(project);
    sendOk(res, 200, structure);
  } catch (err) {
    const msg = err.message || `Projeto "${params.name}" não disponível.`;

    if (msg.includes("não encontrado")) {
      sendError(res, 404, "not_found", msg);
    } else {
      sendError(res, 502, "project_unavailable", msg);
    }
  }
}
