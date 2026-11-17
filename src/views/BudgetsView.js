import dayjs from 'dayjs';
import { apiClient, makeQuery } from '../api.js';
import { moneyWithCurrency, fmtMonthLabel, pct, monthOptions } from '../utils/format.js';
import { destroyAll } from '../utils/charts.js';
import { openModal, toast, notifyError, confirmAction } from '../utils/ui.js';

export const BudgetsView = {
  async mount(root) {
    destroyAll();
    const currentMonth = dayjs().format('YYYY-MM');
    const months = monthOptions();

    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Seguimiento</div>
          <h1 class="display">Presupuesto</h1>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-end">
          <div class="field">
            <label>Mes</label>
            <select class="select select--mono" id="budgetMonth">
              ${months.map((m) => `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${fmtMonthLabel(m)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn--solid" id="newBudgetBtn">+ Asignar</button>
        </div>
      </header>

      <div class="grid grid--stats" style="margin-bottom:20px">
        <div class="stat stat--accent"><div class="stat__label">Presupuesto total</div><div class="stat__value" id="bTotal">—</div></div>
        <div class="stat"><div class="stat__label">Gastado</div><div class="stat__value" id="bSpent">—</div></div>
        <div class="stat"><div class="stat__label">Disponible</div><div class="stat__value" id="bAvail">—</div></div>
        <div class="stat"><div class="stat__label">Cumplimiento</div><div class="stat__value" id="bPct">—</div><div class="stat__delta" id="bPctHint">0 categorías</div></div>
      </div>

      <div class="panel">
        <div class="panel__head">
          <div class="panel__title" id="panelTitle">Presupuestos de ${fmtMonthLabel(currentMonth)}</div>
          <div class="eyebrow">Objetivo por categoría</div>
        </div>
        <div id="budgetList"><div class="empty"><div class="empty__num">…</div><p>Cargando</p></div></div>
      </div>
    `;

    root.querySelector('#budgetMonth').addEventListener('change', (e) => this.load(root, e.target.value));
    root.querySelector('#newBudgetBtn').addEventListener('click', () =>
      this.openModal(root.querySelector('#budgetMonth').value)
    );
    await this.load(root, currentMonth);
  },

  async load(root, month) {
    root.querySelector('#panelTitle').textContent = `Presupuestos de ${fmtMonthLabel(month)}`;
    const list = root.querySelector('#budgetList');
    try {
      const [budgets, summary] = await Promise.all([
        apiClient.get(`/budgets${makeQuery({ month })}`),
        apiClient.get(`/budgets/summary${makeQuery({ month })}`)
      ]);

      const total = summary.totalBudget || 0;
      const spent = summary.totalSpent || 0;
      const avail = total - spent;
      const p = total > 0 ? (spent / total) * 100 : 0;

      root.querySelector('#bTotal').textContent = moneyWithCurrency(total);
      root.querySelector('#bSpent').textContent = moneyWithCurrency(spent);
      root.querySelector('#bAvail').textContent = moneyWithCurrency(avail);
      root.querySelector('#bPct').textContent = total > 0 ? pct(p) : '—';
      root.querySelector('#bPctHint').textContent = `${summary.count} categorías asignadas`;

      if (!budgets.length) {
        list.innerHTML = `
          <div class="empty">
            <div class="empty__num">0</div>
            <p>No hay presupuesto definido para ${fmtMonthLabel(month)}.<br/>
               <button class="btn btn--sm" id="firstBudgetBtn" style="margin-top:14px">Crear el primero</button></p>
          </div>`;
        list.querySelector('#firstBudgetBtn').addEventListener('click', () => this.openModal(month));
        return;
      }

      list.innerHTML = budgets
        .map((b) => {
          const over = b.spent > b.amount && b.amount > 0;
          return `
          <div style="padding:16px 0;border-bottom:1px solid #1c1c1c">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <span class="dot" style="background:${b.categoryColor || '#c7f13a'}"></span>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px">${b.categoryName}</div>
                <div class="mono" style="font-size:12px;color:var(--gray-mid)">${moneyWithCurrency(b.spent)} de ${moneyWithCurrency(b.amount)}</div>
              </div>
              <span class="mono" style="font-size:12px;${over ? 'color:var(--red)' : 'color:var(--lime)'}">${b.amount > 0 ? pct(b.progress * 100) : '—'}</span>
              <div style="display:flex;gap:6px">
                <button class="icon-btn budget-edit" data-id="${b.id}" title="Editar">✎</button>
                <button class="icon-btn icon-btn--danger budget-del" data-id="${b.id}" title="Eliminar">✕</button>
              </div>
            </div>
            <div class="progress ${over ? 'progress--over' : ''}">
              <div class="progress__bar" style="width:${Math.min(Math.max(b.progress * 100, 0), 100)}%"></div>
            </div>
          </div>`;
        })
        .join('');

      list.querySelectorAll('.budget-edit').forEach((btn) =>
        btn.addEventListener('click', () => this.openModal(month, budgets.find((b) => b.id === btn.dataset.id)))
      );
      list.querySelectorAll('.budget-del').forEach((btn) =>
        btn.addEventListener('click', () => this.remove(btn.dataset.id))
      );
    } catch (err) {
      list.innerHTML = `<div class="empty"><div class="empty__num">×</div><p>${err.message}</p></div>`;
    }
  },

  async openModal(month, budget = null) {
    const isEdit = !!budget;
    const cats = (await apiClient.get('/categories?type=expense').catch(() => [])) || [];

    if (!cats.length) {
      return notifyError('No hay categorías de gastos. Crea una primero.');
    }

    const { el, close } = openModal({
      title: budget ? 'Editar presupuesto' : `Asignar presupuesto · ${fmtMonthLabel(month)}`,
      size: 'modal--sm',
      bodyHtml: `
        <form id="budgetForm">
          <div class="field">
            <label>Categoría de gasto</label>
            <select class="select" id="bud-category" ${isEdit ? 'disabled' : ''}>
              ${cats.map((c) => `<option value="${c.id}" ${budget?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Límite mensual ($)</label>
            <input class="input input--mono" type="number" step="0.01" min="0" id="bud-amount" value="${budget?.amount ?? ''}" placeholder="0.00" required />
          </div>
        </form>`,
      footerHtml: `
        <button class="btn btn--ghost" id="bud-cancel">Cancelar</button>
        <button class="btn btn--solid" id="bud-save">${isEdit ? 'Guardar' : 'Asignar'}</button>`
    });

    el.querySelector('#bud-cancel').addEventListener('click', close);
    el.querySelector('#bud-save').addEventListener('click', async () => {
      const payload = {
        categoryId: el.querySelector('#bud-category').value,
        month,
        amount: el.querySelector('#bud-amount').value
      };
      try {
        await apiClient.post('/budgets', payload);
        toast(isEdit ? 'Presupuesto actualizado.' : 'Presupuesto asignado.');
        close();
        this.load(document.querySelector('#view'), month);
      } catch (err) {
        notifyError(err.message);
      }
    });
    el.addEventListener('submit', (e) => e.preventDefault());
  },

  async remove(id) {
    const ok = await confirmAction({ title: 'Quitar presupuesto', text: 'Se eliminará este límite mensual.' });
    if (!ok) return;
    try {
      await apiClient.del(`/budgets/${id}`);
      toast('Presupuesto eliminado.');
      this.load(document.querySelector('#view'), document.querySelector('#budgetMonth').value);
    } catch (err) {
      notifyError(err.message);
    }
  }
};