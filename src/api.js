export const apiClient = {
  token: null,

  setToken(t) {
    this.token = t;
  },

  async request(method, path, body, { raw = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let res;
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch {
      const err = new Error('No se pudo conectar con el servidor. Verifique que la API esté en línea.');
      err.status = 0;
      throw err;
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const err = new Error(json?.error || `Error ${res.status}`);
      err.status = res.status;
      err.details = json?.details || null;
      throw err;
    }

    // Notifica a las vistas montadas (p. ej. panel admin) que hubo cambios de datos.
    if (method !== 'GET' && /^\/(transactions|accounts|categories|budgets)(\/|$)/.test(path) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fp:data-changed', { detail: { method, path } }));
    }

    return raw ? res : json;
  },

  get(path, raw = false) {
    return this.request('GET', path, undefined, { raw });
  },
  post(path, body, raw = false) {
    return this.request('POST', path, body, { raw });
  },
  put(path, body, raw = false) {
    return this.request('PUT', path, body, { raw });
  },
  del(path) {
    return this.request('DELETE', path);
  }
};

export function makeQuery(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}