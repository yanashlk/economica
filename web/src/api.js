export const API_BASE =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) ||
    "";

/**
 * Повертає повний URL до API.
 * @param {string} path "
 */
export function apiUrl(path) {
    const p = path.startsWith("/") ? path : `/${path}`;

    if (!API_BASE) {
        const isProd = import.meta.env.PROD;
        return isProd ? `/api${p}` : p;
    }


    const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

    return `${base}${p}`;
}

/**
 * Безпечне читання відповіді як JSON (або null / raw текст)
 */
export async function parseJsonSafe(r) {
    const text = await r.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { _raw: text };
    }
}

/**
 * GET helper
 */
export async function apiGet(path, options = {}) {
    const r = await fetch(apiUrl(path), options);
    const data = await parseJsonSafe(r);
    if (!r.ok) {
        throw new Error(data?.error || data?._raw || `HTTP ${r.status}`);
    }
    return data;
}

/**
 * JSON helper (POST/PATCH/PUT/DELETE)
 */
export async function apiJson(path, method, body, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const r = await fetch(apiUrl(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        ...options,
    });

    const data = await parseJsonSafe(r);

    if (!r.ok) {
        const err = new Error(data?.error || data?._raw || `HTTP ${r.status}`);
        err.status = r.status;
        err.data = data;
        throw err;
    }

    return data;
}

/**
 * Додає Authorization header для адмінських запитів
 */
export function withAdminAuth(headers = {}) {
    const token = localStorage.getItem("admin_token");
    return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
}