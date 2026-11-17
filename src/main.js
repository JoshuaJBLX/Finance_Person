import './styles/main.css';
import { apiClient } from './api.js';
import { store } from './store.js';
import { initials } from './utils/format.js';

import { AuthView } from './views/AuthView.js';
import { DashboardView } from './views/DashboardView.js';
import { TransactionsView } from './views/TransactionsView.js';
import { AccountsView } from './views/AccountsView.js';
import { CategoriesView } from './views/CategoriesView.js';
import { BudgetsView } from './views/BudgetsView.js';
import { ReportsView } from './views/ReportsView.js';
import { AdminView } from './views/AdminView.js';
import { ProfileView } from './views/ProfileView.js';

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="10" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="15" width="8" height="6" rx="1"/></svg>',
  transactions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/></svg>',
  accounts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="13" rx="1.5"/><path d="M2 10h20M6 15h4"/></svg>',
  categories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18"/><path d="M7 8h10M7 12h10M7 16h10"/></svg>',
  budgets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-6"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3v18M7 3l-4 4M7 3l4 4M5 21h16"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6 20c1.5-2.4 3.4-3.5 6-3.5s4.5 1.1 6 3.5"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
};

function buildNav(user) {
  const links = [
    ['dashboard', 'Dashboard'],
    ['transactions', 'Movimientos'],
    ['accounts', 'Cuentas'],
    ['categories', 'Categorías'],
    ['budgets', 'Presupuestos'],
    ['reports', 'Reportes']
  ];
  if (user.role === 'admin') links.push(['admin', 'Admin']);
  links.push(['profile', 'Perfil']);
  return links;
}

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = hash.split('/');
  return { name: name || 'dashboard', param: rest.join('/') };
}

function renderShell() {
  const user = store.user;
  const { name } = currentRoute();
  const nav = buildNav(user);

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="sidebar__brand">
          <img src="/FP_LOGO.png" alt="Finance Person logo" />
          <div>
            <div class="sidebar__brand-name">Finance <span class="text-lime">Person</span></div>
            <div class="sidebar__brand-sub">Finanzas · SaaS</div>
          </div>
        </div>

        <nav class="nav">
          ${nav.map(([key, label]) => `
            <a href="#/${key}" class="nav__item ${name === key ? 'active' : ''}" data-nav="${key}">
              ${ICONS[key] || ''}
              <span class="label">${label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar__foot">
          <div class="user-chip">
            <div class="avatar ${user.role === 'admin' ? 'avatar--lime' : ''}">${initials(`${user.firstName} ${user.lastName}`)}</div>
            <div class="user-chip__meta">
              <div class="user-chip__name">${user.firstName} ${user.lastName}</div>
              <div class="user-chip__role">${user.role === 'admin' ? 'Administrador' : 'Usuario'}</div>
            </div>
            <button type="button" class="icon-btn icon-btn--danger" id="logoutBtn" title="Cerrar sesión" aria-label="Cerrar sesión">${ICONS.logout}</button>
          </div>
        </div>
      </aside>

      <main class="app__main" id="view"></main>
    </div>
  `;

  app.querySelector('#logoutBtn').addEventListener('click', onLogout);
}

function onLogout() {
  store.logout();
  apiClient.setToken(null);
  location.hash = '#/login';
}

const routes = {
  dashboard: DashboardView,
  transactions: TransactionsView,
  accounts: AccountsView,
  categories: CategoriesView,
  budgets: BudgetsView,
  reports: ReportsView,
  admin: AdminView,
  profile: ProfileView
};

function render() {
  const app = document.getElementById('app');
  const { name, param } = currentRoute();

  if (!store.user) {
    if (!['login', 'register', 'forgot', 'reset'].includes(name)) {
      location.replace('#/login');
      return;
    }
    app.innerHTML = '';
    const mount = document.createElement('div');
    app.appendChild(mount);
    AuthView.mount(mount, { mode: name, param });
    return;
  }

  if (name === 'admin' && !store.isAdmin) {
    location.replace('#/dashboard');
    return;
  }

  renderShell();
  const viewEl = app.querySelector('#view');
  const View = routes[name] || DashboardView;
  View.mount(viewEl, { param });
}

window.addEventListener('hashchange', render);

function bootstrap() {
  const s = store.session;
  if (s?.token) apiClient.setToken(s.token);
  render();
}

bootstrap();