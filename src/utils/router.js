/**
 * Router — minimal pattern-matching router for node:http.
 * Avoids adding express as a dependency.
 */

/**
 * @typedef {Object} Route
 * @property {string} method
 * @property {string} pattern — e.g. "/api/projects" or "/api/explore/:project/search"
 * @property {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, params: Record<string,string>, query: URLSearchParams) => Promise<void>} handler
 */

export function createRouter() {
  /** @type {Route[]} */
  const routes = [];

  /**
   * @param {string} method
   * @param {string} pattern
   * @param {Route["handler"]} handler
   */
  function add(method, pattern, handler) {
    routes.push({ method, pattern, handler });
  }

  /**
   * Matches a URL against registered routes.
   * @param {string} method
   * @param {string} pathname
   * @returns {{ route: Route, params: Record<string,string> } | null}
   */
  function match(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;

      const params = matchPattern(route.pattern, pathname);

      if (params) {
        return { route, params };
      }
    }

    return null;
  }

  /**
   * Dispatches a request through the router.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @returns {Promise<boolean>} — true if a route matched
   */
  async function dispatch(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const result = match(req.method, url.pathname);

    if (!result) return false;

    await result.route.handler(req, res, result.params, url.searchParams);
    return true;
  }

  return { add, match, dispatch };
}

/**
 * @param {string} pattern
 * @param {string} pathname
 * @returns {Record<string,string> | null}
 */
function matchPattern(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const ap = pathParts[i];

    if (pp.startsWith(":")) {
      params[pp.slice(1)] = decodeURIComponent(ap);
    } else if (pp !== ap) {
      return null;
    }
  }

  return params;
}
