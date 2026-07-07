/**
 * Cache routes — inspect and clear symbol index cache.
 *
 * GET    /api/cache/symbols
 * DELETE /api/cache/symbols?project=faturas-backend
 */

import {
  clearSymbolIndexCache,
  getSymbolIndexCacheStats
} from "../lib/symbol-index.js";
import { sendOk, sendError } from "../utils/response.js";
import { validateProjectName } from "../utils/validation.js";

/**
 * GET /api/cache/symbols
 */
export async function handleSymbolCacheStats(req, res) {
  sendOk(res, 200, getSymbolIndexCacheStats());
}

/**
 * DELETE /api/cache/symbols?project=optionalProjectName
 */
export async function handleClearSymbolCache(req, res, _params, query) {
  const project = query.get("project");

  if (project) {
    const v = validateProjectName(project);
    if (!v.valid) {
      sendError(res, 400, "invalid_project", v.error);
      return;
    }
  }

  const result = clearSymbolIndexCache(project || null);
  sendOk(res, 200, result, project ? `Cache limpo para ${project}.` : "Cache de símbolos limpo.");
}
