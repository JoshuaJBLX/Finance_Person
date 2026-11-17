import { apiClient } from '../api.js';
import { moneyWithCurrency } from '../utils/format.js';
import { destroyAll } from '../utils/charts.js';
import { openModal, toast, notifyError, confirmAction } from '../utils/ui.js';

const TYPE_LABEL = { cash: 'Efectivo', bank: 'Banco', savings: 'Ahorro', credit: 'Tarjeta', other: 'Otra' };

export const AccountsView = {
  async mount(root) {
    destroyAll();
    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Medios de pago</div>
          <h1 class="display">Cuentas</h1>
        </div>
        <button class="btn btn--solid" id="newAccBtn">+ Nueva cuenta</button>
      </header>

      <div class="grid grid--3 grid--stats" id="accGrid">
        <div class="empty"><div class="empty__num">…</div><p>Cargando</p></div>
      </div>

      <div class="panel" style="margin-top:20px">
        <div class="panel__head">
          <div class="panel__title">Distribución por cuenta</div>
          <div class="eyebrow">Ingresos & gastos</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Cuenta</th><th>Tipo</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Gastos</th><th style="text-align:right">Resultado</th></tr></thead>
            <tbody id="accBody"></tbody>
          </table>
        </div>
      </div>
    `;

    root.querySelector('#newAccBtn').addEventListener('click', () => this.openModal());
    await this.load(root);
  },

  async load(root) {
    const accounts = await apiClient.get('/accounts').catch(() => []);
    const grid = root.querySelector('#accGrid');

    if (!accounts.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty__num">0</div><p>No tienes cuentas todavía.<br/>Crea tu primera cuenta para empezar.</p></div>`;
    } else {
      grid.innerHTML = accounts
        .map(
          (a) => `
        <div class="account-card ${a.isDefault ? 'is-default' : ''}">
          <div class="account-card__top">
            <div>
              <div class="account-card__name">${a.name}</div>
              <div class="account-card__type">${TYPE_LABEL[a.type] || a.type}${a.isDefault ? ' · Principal' : ''}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="icon-btn acc-default" data-id="${a.id}" title="Marcar como principal">◆</button>
              <button class="icon-btn acc-edit" data-id="${a.id}" title="Editar">✎</button>
              <button class="icon-btn icon-btn--danger acc-del" data-id="${a.id}" title="Eliminar">✕</button>
            </div>
          </div>
          <div>
            <div class="eyebrow mb-0">Saldo</div>
            <div class="account-card__balance ${a.balance < 0 ? 'text-red' : ''}">${moneyWithCurrency(a.balance)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;color:var(--gray-mid)">
            <span class="text-green">▲ ${moneyWithCurrency(a.income)}</span>
            <span class="text-red">▼ ${moneyWithCurrency(a.expenses)}</span>
          </div>
        </div>`
        )
        .join('');

      grid.querySelectorAll('.acc-edit').forEach((b) =>
        b.addEventListener('click', () => this.openModal(accounts.find((a) => a.id === b.dataset.id)))
      );
      grid.querySelectorAll('.acc-del').forEach((b) =>
        b.addEventListener('click', () => this.remove(b.dataset.id))
      );
      grid.querySelectorAll('.acc-default').forEach((b) =>
        b.addEventListener('click', () => this.setDefault(b.dataset.id))
      );
    }

    const detail = await apiClient.get('/reports/by-account').catch(() => []);
    const body = root.querySelector('#accBody');
    if (!detail.length) {
      body.innerHTML = '<tr><td colspan="5"><span class="text-mid">Sin movimientos en el período.</span></td></tr>';
    } else {
      body.innerHTML = detail
        .map(
          (r) => `
        <tr>
          <td>${accounts.find((a) => a.id === r.accountId)?.name || r.accountName}</td>
          <td class="text-mid">${TYPE_LABEL[r.accountType] || r.accountType}</td>
          <td class="mono text-green" style="text-align:right">${moneyWithCurrency(r.income)}</td>
          <td class="mono text-red" style="text-align:right">${moneyWithCurrency(r.expenses)}</td>
          <td class="mono" style="text-align:right">${moneyWithCurrency(r.income - r.expenses)}</td>
        </tr>`
        )
        .join('');
    }
  },

  openModal(acc = null) {
    const isEdit = !!acc;
    const { el, close } = openModal({
      title: acc ? 'Editar cuenta' : 'Nueva cuenta',
      size: 'modal--sm',
      bodyHtml: `
        <form id="accForm">
          <div class="field">
            <label>Nombre</label>
            <input class="input" id="acc-name" value="${acc?.name ?? ''}" placeholder="Ej.: Banco Nación, Efectivo…" required />
          </div>
          <div class="field">
            <label>Tipo</label>
            <select class="select" id="acc-type">
              ${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${acc?.type === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Saldo inicial</label>
            <input class="input input--mono" type="number" step="0.01" id="acc-balance" value="${acc?.initialBalance ?? 0}" />
          </div>
        </form>`,
      footerHtml: `
        <button class="btn btn--ghost" id="acc-cancel">Cancelar</button>
        <button class="btn btn--solid" id="acc-save">${isEdit ? 'Guardar' : 'Crear'}</button>`
    });

    el.querySelector('#acc-cancel').addEventListener('click', close);
    el.querySelector('#acc-save').addEventListener('click', async () => {
      const payload = {
        name: el.querySelector('#acc-name').value,
        type: el.querySelector('#acc-type').value,
        initialBalance: Number(el.querySelector('#acc-balance').value || 0)
      };
      try {
        if (isEdit) await apiClient.put(`/accounts/${acc.id}`, payload);
        else {
          const created = await apiClient.post('/accounts', payload);
          await apiClient.put(`/accounts/${created.id}/default`);
        }
        toast(isEdit ? 'Cuenta actualizada.' : 'Cuenta creada.');
        close();
        this.load(document.querySelector('#view'));
      } catch (err) {
        notifyError(err.message);
      }
    });
    el.addEventListener('submit', (e) => e.preventDefault());
  },

  async setDefault(id) {
    try {
      await apiClient.put(`/accounts/${id}/default`);
      toast('Cuenta principal actualizada.');
      this.load(document.querySelector('#view'));
    } catch (err) {
      notifyError(err.message);
    }
  },

  async remove(id) {
    const ok = await confirmAction({ title: 'Eliminar cuenta', text: 'Se eliminará esta cuenta. No se puede eliminar si tiene movimientos asociados.' });
    if (!ok) return;
    try {
      await apiClient.del(`/accounts/${id}`);
      toast('Cuenta eliminada.');
      this.load(document.querySelector('#view'));
    } catch (err) {
      notifyError(err.message);
    }
  }
};