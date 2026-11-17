/**
 * Verificación UI headless (jsdom + API real sobre BD MongoDB de pruebas).
 *
 * Monta las vistas del frontend contra la API en vivo y comprueba que
 * CADA dato que se visualiza coincide con lo que devuelve la API:
 *   - Panel de administración: 6 tarjetas de estadísticas + tabla de usuarios.
 *   - Dashboard: KPIs del mes, patrimonio y presupuesto.
 *   - Movimientos: contador y filas de la tabla.
 *   - Actualización en vivo: tras crear un movimiento, el panel admin se refresca solo.
 *
 * Uso: npm run test:ui
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.env.NODE_ENV = process.env.NODE_ENV || 'test'; // stub de Chart.js en headless (src/utils/charts.js)
const PORT = 4198;
const TMP = join(os.tmpdir(), 'opencode', `fp-ui-test-${Date.now()}`);
mkdirSync(TMP, { recursive: true });
const DB_PATH = join(TMP, 'finance-ui.db');
const BASE = `http://127.0.0.1:${PORT}`;

/* ---------- Estado ---------- */
const stats = { passed: 0, failed: 0, failures: [] };
const check = (name, cond, extra = '') => {
  if (cond) { stats.passed++; console.log(`  ✓ ${name}`); }
  else { stats.failed++; stats.failures.push(name); console.log(`  ✗ ${name}${extra ? `  [${extra}]` : ''}`); }
};
const section = (t) => console.log(`\n▸ ${t}`);
let api;

/* ---------- Servidor ---------- */
const child = spawn(process.execPath, ['server/app.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', (d) => (logs += d));
child.stderr.on('data', (d) => (logs += d));

const waitUp = async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* no listo aún */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('No arrancó el servidor:\n' + logs.slice(-2000));
};

/* ---------- Entorno DOM (jsdom) ---------- */
function setupDOM() {
  const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'http://localhost' });
  const { window } = dom;
  const g = globalThis;
  g.window = window;
  g.document = window.document;
  Object.defineProperty(g, 'navigator', { value: window.navigator, configurable: true });
  g.localStorage = window.localStorage;
  g.CustomEvent = window.CustomEvent;
  g.HTMLElement = window.HTMLElement;
  g.Event = window.Event;
  g.getComputedStyle = window.getComputedStyle;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  g.ResizeObserver = window.ResizeObserver;
  g.matchMedia = window.matchMedia;
  g.MutationObserver = window.MutationObserver;
  g.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  g.cancelAnimationFrame = (id) => clearTimeout(id);
  window.HTMLCanvasElement.prototype.getContext = function () {
    const ctx = new Proxy(
      { canvas: this },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          if (prop === 'measureText') return () => ({ width: 12, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 6 });
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
          return () => ctx;
        },
        set() { return true; }
      }
    );
    return ctx;
  };

  // fetch que resuelve rutas relativas hacia la API de pruebas
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' && input.startsWith('/') ? BASE + input : input;
    return originalFetch(url, init);
  };
  return dom;
}

/* ---------- Ejecución ---------- */
(async () => {
  try {
    await waitUp();
    setupDOM();

    const { default: dayjs } = await import('dayjs');
    const { apiClient } = await import('../src/api.js');
    const { store } = await import('../src/store.js');
    api = apiClient;

    const login = async (email, password) => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return res.json();
    };

    const adminSession = await login('admin@finance.person', 'Admin12345');
    const demoSession = await login('demo@finance.person', 'Demo12345');
    api.setToken(adminSession.token);

    const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)).toString();

    /* ==== 1. ADMIN ==== */
    section('Panel de administración: tarjetas vs API');
    {
      const { AdminView } = await import('../src/views/AdminView.js');
      const root = document.getElementById('view');
      await AdminView.mount(root);

      const apiStats = await fetch(`${BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${adminSession.token}` } }).then((r) => r.json());

      const text = (id) => root.querySelector(`#${id}`)?.textContent.trim();
      check('Usuarios coincide', text('aUsers') === String(apiStats.users), `UI=${text('aUsers')} API=${apiStats.users}`);
      check('Movimientos coincide', text('aTx') === String(apiStats.transactions), `UI=${text('aTx')} API=${apiStats.transactions}`);
      check('Ingresos globales coincide', text('aIncome') === `$ ${apiStats.income.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `UI=${text('aIncome')} API=${apiStats.income}`);
      check('Gastos globales coincide', text('aExpenses') === `$ ${apiStats.expenses.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `UI=${text('aExpenses')} API=${apiStats.expenses}`);
      check('Cuentas coincide', text('aAccounts') === String(apiStats.accounts), `UI=${text('aAccounts')} API=${apiStats.accounts}`);
      check('Categorías coincide', text('aCategories') === String(apiStats.categories), `UI=${text('aCategories')} API=${apiStats.categories}`);

      const userRes = await fetch(`${BASE}/api/admin/users?limit=100`, { headers: { Authorization: `Bearer ${adminSession.token}` } }).then((r) => r.json());
      const rows = [...root.querySelectorAll('#userBody tr')];
      check('Tabla de usuarios muestra a todos los tenants', rows.length === userRes.rows.length && rows.length >= 3, `UI=${rows.length} API=${userRes.rows.length}`);
      const emails = userRes.rows.map((u) => u.email);
      check('Demo, Valen y Admin visibles en la tabla', ['demo@finance.person', 'valen@finance.person', 'admin@finance.person'].every((e) => emails.includes(e)));
    }

    /* ==== 2. Dashboard (demo) ==== */
    section('Dashboard: KPIs vs API (demo, mes actual y patrimonio)');
    let dashRoot;
    {
      api.setToken(demoSession.token);
      store.session = { user: demoSession.user, token: demoSession.token };
      const { DashboardView } = await import('../src/views/DashboardView.js');
      dashRoot = document.getElementById('view');
      try { await DashboardView.mount(dashRoot); } catch (e) { console.log('  (aviso) chart en jsdom:', e.message); }

      const now = dayjs();
      const month = now.format('YYYY-MM');
      const from = now.startOf('month').format('YYYY-MM-DD');
      const to = now.endOf('month').format('YYYY-MM-DD');
      const summary = await fetch(`${BASE}/api/reports/summary?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${demoSession.token}` } }).then((r) => r.json());
      const accounts = await fetch(`${BASE}/api/accounts`, { headers: { Authorization: `Bearer ${demoSession.token}` } }).then((r) => r.json());
      const totAccounts = accounts.reduce((s, a) => s + a.balance, 0);
      const money = (v) => `$ ${(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const t = (id) => dashRoot.querySelector(`#${id}`)?.textContent.trim();
      check('Ingresos del mes', t('kpiIncome') === money(summary.income), `UI=${t('kpiIncome')} API=${money(summary.income)}`);
      check('Gastos del mes', t('kpiExpense') === money(summary.expenses), `UI=${t('kpiExpense')} API=${money(summary.expenses)}`);
      check('Balance neto', t('kpiBalance') === money(summary.balance), `UI=${t('kpiBalance')} API=${money(summary.balance)}`);
      check('Patrimonio total (suma cuentas)', t('kpiTotal') === money(totAccounts), `UI=${t('kpiTotal')} API=${money(totAccounts)}`);
      const rate = summary.income > 0 ? `Tasa de ahorro ${summary.savingsRate.toFixed(1)}%` : 'Sin ingresos registrados';
      check('Tasa de ahorro', (t('kpiRate') || '').replace(/&amp;/g, '&') === rate, `UI=${t('kpiRate')} API=${rate}`);

      const chip = dashRoot.querySelector('#budgetChip')?.textContent.trim();
      const budgets = await fetch(`${BASE}/api/budgets?month=${month}`, { headers: { Authorization: `Bearer ${demoSession.token}` } }).then((r) => r.json());
      const bSum = budgets.reduce((s, b) => s + b.amount, 0);
      const bSpent = await fetch(`${BASE}/api/budgets/summary?month=${month}`, { headers: { Authorization: `Bearer ${demoSession.token}` } }).then((r) => r.json());
      const pctVal = bSum > 0 ? Math.round((bSpent.totalSpent / bSum) * 100) : 0;
      check('Chip de presupuesto "% utilizado"', chip === `${pctVal}% utilizado`, `UI=${chip} espera=${pctVal}% utilizado`);
      check('Presupuesto muestra N categorías', [...dashRoot.querySelectorAll('#budgetContent [style*="border-bottom"]')].length === Math.min(budgets.length, 4));

      const accountLines = [...dashRoot.querySelectorAll('#accountList li')];
      check('Resumen por cuentas: una fila por cuenta', accountLines.length === accounts.length, `UI=${accountLines.length} API=${accounts.length}`);
      const firstAcc = accounts[0];
      check(`Saldo de "${firstAcc.name}" en el listado`, accountLines.find((li) => li.textContent.includes(firstAcc.name))?.textContent.includes(money(firstAcc.balance)));
    }

    /* ==== 3. Movimientos (demo) ==== */
    section('Movimientos: contador y filas vs API');
    {
      const { TransactionsView } = await import('../src/views/TransactionsView.js');
      const root = document.getElementById('view');
      await TransactionsView.mount(root);

      const res = await fetch(`${BASE}/api/transactions?limit=500`, { headers: { Authorization: `Bearer ${demoSession.token}` } }).then((r) => r.json());
      check('Contador de movimientos', root.querySelector('#txCount').textContent.trim() === `${res.total} movimientos`, `UI=${root.querySelector('#txCount').textContent.trim()} API=${res.total}`);
      const visible = [...root.querySelectorAll('#txBody tr')].filter((tr) => tr.dataset.id);
      check('Tabla renderiza todos los movimientos devueltos', visible.length === res.rows.length, `UI=${visible.length} API=${res.rows.length}`);
      check('Montos con signo correcto (+/−) en la primera fila', visible[0]?.textContent.includes('+ $') || visible[0]?.textContent.includes('− $'));
    }

    /* ==== 4. Actualización en vivo del panel admin ==== */
    section('Actualización en vivo: crear movimiento y ver estadísticas cambiar');
    {
      const { AdminView } = await import('../src/views/AdminView.js');
      const root = document.getElementById('view');
      api.setToken(adminSession.token);
      await AdminView.mount(root);

      const before = Number(root.querySelector('#aTx').textContent.trim());
      const cats = await fetch(`${BASE}/api/categories`, { headers: { Authorization: `Bearer ${adminSession.token}` } }).then((r) => r.json());
      const accounts = await fetch(`${BASE}/api/accounts`, { headers: { Authorization: `Bearer ${adminSession.token}` } }).then((r) => r.json());
      const salario = cats.find((c) => c.type === 'income')?.id;
      await api.post('/transactions', {
        type: 'income',
        accountId: accounts[0].id,
        categoryId: salario,
        amount: 1234.5,
        description: 'Verificación en vivo',
        date: dayjs().format('YYYY-MM-DD')
      });

      await new Promise((r) => setTimeout(r, 500)); // deja que el debounce refresque (120 ms)
      const after = Number(root.querySelector('#aTx').textContent.trim());
      check('Tras crear un movimiento, el panel se refresca solo (+1)', after === before + 1, `antes=${before} despues=${after}`);

      const stats2 = await fetch(`${BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${adminSession.token}` } }).then((r) => r.json());
      check('El nuevo total coincide con la API', Number(root.querySelector('#aTx').textContent) === stats2.transactions);
      const created = await fetch(`${BASE}/api/transactions?search=Verificaci%C3%B3n%20en%20vivo`, { headers: { Authorization: `Bearer ${adminSession.token}` } }).then((r) => r.json());
      check('El movimiento creado queda registrado en la API', created.total === 1 && created.rows[0].amount === 1234.5);
    }

    console.log('\n========================================');
    console.log(`RESUMEN UI: ${stats.passed} verificaciones correctas · ${stats.failed} incorrectas`);
    if (stats.failed) {
      console.log('\nFallos:');
      stats.failures.forEach((f) => console.log(`  - ${f}`));
    } else {
      console.log('TODA LA INFORMACIÓN SE VISUALIZA CORRECTAMENTE ✔');
    }
  } catch (err) {
    console.error('\nERROR en verificación UI:', err.message);
    console.error(logs.slice(-2500));
    stats.failed++;
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 300));
    rmSync(TMP, { recursive: true, force: true });
  }
  process.exitCode = stats.failed ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 50);
})();