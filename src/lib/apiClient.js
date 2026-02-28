import { Auth } from "aws-amplify";
import { API_URL } from "./apiConfig";

/**
 * Get current session token (id or access).
 * Returns null if not authenticated.
 */
export async function getIdToken() {
  try {
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  } catch {
    return null;
  }
}

export async function getAccessToken() {
  try {
    const session = await Auth.currentSession();
    return session.getAccessToken().getJwtToken();
  } catch {
    return null;
  }
}

/**
 * Centralized fetch wrapper with auth.
 * Automatically attaches Bearer token and handles errors.
 *
 * @param {string} endpoint  - path after API_URL, e.g. "/admin/contracts/meta"
 * @param {object} [options] - fetch options (method, body, headers, etc.)
 * @param {object} [opts]    - extra options:
 *   tokenType: "id" | "access" (default "access")
 *   raw: true to return raw Response instead of parsed JSON
 */
export async function apiFetch(endpoint, options = {}, opts = {}) {
  const tokenType = opts.tokenType || "access";
  const token =
    tokenType === "id" ? await getIdToken() : await getAccessToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  if (opts.raw) return res;
  return res.json();
}

/** Convenience: GET with auth */
export const apiGet = (endpoint, opts) =>
  apiFetch(endpoint, { method: "GET" }, opts);

/** Convenience: POST with auth */
export const apiPost = (endpoint, body, opts) =>
  apiFetch(
    endpoint,
    { method: "POST", body: JSON.stringify(body) },
    opts
  );

/** Convenience: DELETE with auth */
export const apiDelete = (endpoint, body, opts) =>
  apiFetch(
    endpoint,
    { method: "DELETE", ...(body ? { body: JSON.stringify(body) } : {}) },
    opts
  );
