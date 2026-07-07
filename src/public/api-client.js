/*
 * API client helpers.
 *
 * Backend responses use the envelope:
 *   { ok: boolean, data?: any, error?: string, message?: string }
 *
 * This helper unwraps that envelope while preserving backwards compatibility
 * with older raw responses.
 */
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || text || `HTTP ${response.status}`);
  }

  if (payload?.ok === false) {
    throw new Error(payload.message || payload.error || "Erro na API");
  }

  if (payload?.ok === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      return {
        ...payload.data,
        message: payload.message || payload.data.message
      };
    }

    return payload.data;
  }

  return payload;
}
