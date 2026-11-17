const KEY = 'fp_session';

export const store = {
  get session() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || null;
    } catch {
      return null;
    }
  },

  set session(value) {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  },

  get token() {
    return this.session?.token || null;
  },

  get user() {
    return this.session?.user || null;
  },

  get isAdmin() {
    return this.user?.role === 'admin';
  },

  login(user, token) {
    this.session = { user, token };
  },

  updateUser(user) {
    const s = this.session;
    if (s) this.session = { ...s, user };
  },

  logout() {
    this.session = null;
  }
};