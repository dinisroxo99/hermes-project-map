/**
 * Response utilities — consistent JSON envelope for all API endpoints.
 *
 * Envelope shape:
 *   { ok: boolean, data?: any, error?: string, message?: string }
 */

export function ok(data, message) {
  return {
    ok: true,
    data,
    message
  };
}

export function fail(error, message) {
  return {
    ok: false,
    error,
    message
  };
}

/**
 * Sends a success JSON response with consistent envelope.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {any} data
 * @param {string} [message]
 */
export function sendOk(res, status, data, message) {
  sendJson(res, status, ok(data, message));
}

/**
 * Sends an error JSON response with consistent envelope.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} error
 * @param {string} [message]
 */
export function sendError(res, status, error, message) {
  sendJson(res, status, fail(error, message));
}

/**
 * Low-level JSON sender — sets headers and stringifies payload.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} payload
 */
export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });

  res.end(body);
}
