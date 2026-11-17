import dayjs from 'dayjs';
import { apiClient, makeQuery } from '../api.js';
import { store } from '../store.js';
import { moneyWithCurrency, fmtMonthShort, fmtMonthLabel, pct } from '../utils/format.js';
import { destroyAll, lineChart, doughnutChart, PALETTE } from '../utils/charts.js';

export const DashboardView = {
  async mount(root) {
    destroyAll();
    const now = dayjs();
    const from = now.startOf('month').format('YYYY-MM-DD');
    const to = now.endOf('month').format('YYYY-MM-DD');
    const twelveAgo = now.subtract(11, 'month').startOf('month').format('YYYY-MM-DD');
    const month = now.format('YYYY-MM');

    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Hola, ${store.user.firstName}</div>
          <h1 class="display">Tu pulso<br class="mobile-only"/><span class="display--lime">financiero</span></h1>
        </div>
        <div class="stamp-num">${fmtMonthLabel(month)}</div>
      </header>

      <div class="grid grid--stats" id="kpis" style="margin-bottom:20px">
        <div class="stat"><div class="stat__label">Ingresos del mes</div><div class="stat__value" id="kpiIncome">—</div></div>
        <div class="stat"><div class="stat__label">Gastos del mes</div><div class="stat__value" id="kpiExpense">—</div></div>
        <div class="stat stat--accent"><div class="stat__label">Balance neto</div><div class="stat__value" id="kpiBalance">—</div><div class="stat__delta" id="kpiRate"></div></div>
        <div class="stat"><div class="stat__label">Patrimonio total</div><div class="stat__value" id="kpiTotal">—</div><div class="stat__delta">Suma de cuentas</div></div>
      </div>

      <div class="grid grid--asym">
        <div class="panel">
          <div class="panel__head">
            <div class="panel__title">Evolución · 12 meses</div>
            <div class="eyebrow">Ingresos vs gastos</div>
          </div>
          <div class="chart-holder"><canvas id="lineChart"></canvas></div>
        </div>

        <div class="panel">
          <div class="panel__head">
            <div class="panel__title">Gastos del mes</div>
            <div class="eyebrow">Por categoría</div>
          </div>
          <div class="chart-holder chart-holder--sm"><canvas id="doughnutChart"></canvas></div>
        </div>
      </div>

      <div class="grid grid--2" style="margin-top:20px">
        <div class="panel panel--lime-edge">
          <div class="panel__head">
            <div class="panel__title">Presupuesto actual</div>
            <span class="chip chip--income" id="budgetChip">…</span>
          </div>
          <div id="budgetContent"><div class="empty"><div class="empty__num">—</div><p>Cargando presupuesto…</p></div></div>
        </div>

        <div class="panel">
          <div class="panel__head">
            <div class="panel__title">Resumen por cuentas</div>
            <div class="eyebrow">Saldo disponible</div>
          </div>
          <ul class="icon-list" id="accountList"><li><span class="text-mid">Cargando…</span></li></ul>
        </div>
      </div>
    `;

    const [summary, monthly, byCat, budgets, accounts, budgetSummary] = await Promise.all([
      apiClient.get(`/reports/summary${makeQuery({ from, to })}`).catch(() => null),
      apiClient.get(`/reports/monthly${makeQuery({ from: twelveAgo, to: now.format('YYYY-MM-DD') })}`).catch(() => null),
      apiClient.get(`/reports/by-category${makeQuery({ type: 'expense', from, to })}`).catch(() => null),
      apiClient.get(`/budgets${makeQuery({ month })}`).catch(() => null),
      apiClient.get('/accounts').catch(() => null),
      apiClient.get(`/budgets/summary${makeQuery({ month })}`).catch(() => null)
    ]);

    if (!summary) {
      root.innerHTML = `<div class="empty"><div class="empty__num">×</div><p>No se pudieron cargar los datos.<br/><button class="btn btn--sm" id="retryBtn" style="margin-top:12px">Reintentar</button></p></div>`;
      root.querySelector('#retryBtn').addEventListener('click', () => this.mount(root));
      return;
    }

    // KPI
    const kpiIncome = root.querySelector('#kpiIncome');
    const kpiExpense = root.querySelector('#kpiExpense');
    const kpiBalance = root.querySelector('#kpiBalance');
    const kpiRate = root.querySelector('#kpiRate');
    const kpiTotal = root.querySelector('#kpiTotal');

    kpiIncome.textContent = moneyWithCurrency(summary.income);
    kpiExpense.textContent = moneyWithCurrency(summary.expenses);
    kpiBalance.textContent = moneyWithCurrency(summary.balance);
    kpiRate.textContent = summary.income > 0 ? `Tasa de ahorro ${summary.savingsRate.toFixed(1)}%` : 'Sin ingresos registrados';

    const accountsTotal = (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
    kpiTotal.textContent = moneyWithCurrency(accountsTotal);

    // Line chart
    const months = (monthly || []).map((m) => m.month);
    const padded = padMonths(monthly || [], elevenMonthsFrom(twelveAgo));
    lineChart(
      'lineChart',
      padded.map((m) => fmtMonthShort(m.month)),
      padded.map((m) => m.income),
      padded.map((m) => m.expenses)
    );

    // Doughnut
    const catData = byCat?.data?.length ? byCat.data : [{ name: 'Sin gastos', color: '#2b2b2b', total: 1 }];
    doughnutChart(
      'doughnutChart',
      catData.map((c) => c.name),
      catData.map((c) => c.total),
      catData.map((c, i) => c.color || PALETTE[i % PALETTE.length])
    );

    // Budget
    renderBudget(root, budgets || [], budgetSummary);
    renderAccounts(root, accounts || []);
  }
};

function elevenMonthsFrom(startISO) {
  return dayjs(startISO).add(11, 'month').format('YYYY-MM');
}

function padMonths(list, endKey) {
  const map = new Map(list.map((m) => [m.month, m]));
  const out = [];
  const start = dayjs(endKey).subtract(11, 'month');
  for (let i = 0; i < 12; i++) {
    const key = start.add(i, 'month').format('YYYY-MM');
    const row = map.get(key);
    out.push(row ? row : { month: key, income: 0, expenses: 0 });
  }
  return out;
}

function renderBudget(root, budgets, summary) {
  const content = root.querySelector('#budgetContent');
  const chip = root.querySelector('#budgetChip');
  if (!budgets.length) {
    chip.textContent = 'Sin presupuesto';
    content.innerHTML = `
      <div class="empty">
        <div class="empty__num">0</div>
        <p>Aún no definiste presupuesto para este mes.<br/><a href="#/budgets">Configurar ahora</a></p>
      </div>`;
    return;
  }

  const spent = summary?.totalSpent || 0;
  const total = budgets.reduce((s, b) => s + b.amount, 0);
  const p = total > 0 ? (spent / total) * 100 : 0;
  chip.textContent = `${p.toFixed(0)}% utilizado`;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
      <span class="mono text-mid" style="font-size:12px">${moneyWithCurrency(spent)} / ${moneyWithCurrency(total)}</span>
      <span class="mono ${p > 100 ? 'text-red' : 'text-lime'}" style="font-size:12px">${pct(p)}</span>
    </div>
    <div class="progress ${p > 100 ? 'progress--over' : ''}"><div class="progress__bar" style="width:${Math.min(p, 100)}%"></div></div>
    <div style="margin-top:16px">
      ${budgets.slice(0, 4).map((b) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1c1c1c">
          <span class="dot" style="background:${b.categoryColor || '#c7f13a'}"></span>
          <span style="flex:1;font-size:13.5px">${b.categoryName}</span>
          <span class="mono ${b.spent > b.amount ? 'text-red' : ''}" style="font-size:12.5px">${moneyWithCurrency(b.spent)} / ${moneyWithCurrency(b.amount)}</span>
        </div>`).join('')}
      ${budgets.length > 4 ? `<div style="margin-top:10px"><a href="#/budgets" style="font-size:13px">Ver todos →</a></div>` : ''}
    </div>`;
}

function renderAccounts(root, accounts) {
  const list = root.querySelector('#accountList');
  if (!accounts.length) {
    list.innerHTML = '<li><span class="text-mid">Sin cuentas.</span> <a href="#/accounts">Crear</a></li>';
    return;
  }
  list.innerHTML = accounts
    .map(
      (a) => `
      <li>
        <span class="dot" style="background:${a.isDefault ? '#c7f13a' : '#2b2b2b'}"></span>
        <div class="icon-list__label">
          <div class="icon-list__name">${a.name}</div>
          <div class="icon-list__meta">${a.type}${a.isDefault ? ' · Principal' : ''}</div>
        </div>
        <span class="mono" style="font-weight:700">${moneyWithCurrency(a.balance)}</span>
      </li>`
    )
    .join('');
}