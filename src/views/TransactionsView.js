import { apiClient, makeQuery } from '../api.js';
import { moneyWithCurrency, fmtDate, todayISO } from '../utils/format.js';
import { destroyAll } from '../utils/charts.js';
import { openModal, toast, notifyError, confirmAction } from '../utils/ui.js';

let state = {
  filters: { type: '', categoryId: '', accountId: '', from: '', to: '', search: '' },
  categories: [],
  accounts: []
};

export const TransactionsView = {
  async mount(root) {
    destroyAll();
    state.categories = (await apiClient.get('/categories').catch(() => [])) || [];
    state.accounts = (await apiClient.get('/accounts').catch(() => [])) || [];

    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Historial</div>
          <h1 class="display">Movimientos</h1>
        </div>
        <button class="btn btn--solid" id="newTxBtn">+ Nuevo movimiento</button>
      </header>

      <form class="filters" id="filtersForm">
        <div class="field">
          <label>Desde</label>
          <input class="input input--mono" type="date" id="f-from" />
        </div>
        <div class="field">
          <label>Hasta</label>
          <input class="input input--mono" type="date" id="f-to" />
        </div>
        <div class="field">
          <label>Tipo</label>
          <select class="select" id="f-type">
            <option value="">Todos</option>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>
        </div>
        <div class="field">
          <label>Categoría</label>
          <select class="select" id="f-category">
            <option value="">Todas</option>
            ${state.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Cuenta</label>
          <select class="select" id="f-account">
            <option value="">Todas</option>
            ${state.accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
        </div>
        <div class="field field--auto">
          <label>Buscar</label>
          <input class="input" id="f-search" placeholder="Descripción…" style="min-width:160px" />
        </div>
        <div class="field field--auto">
          <label>&nbsp;</label>
          <button class="btn" type="submit">Filtrar</button>
          <button class="btn btn--ghost" type="button" id="f-clear" style="margin-left:0">Limpiar</button>
        </div>
      </form>

      <div class="panel" style="padding:0">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th style="text-align:right">Monto</th>
                <th style="text-align:right">Acciones</th>
              </tr>
            </thead>
            <tbody id="txBody"><tr><td colspan="7"><div class="empty"><div class="empty__num">…</div><p>Cargando movimientos</p></div></td></tr></tbody>
          </table>
        </div>
        <div style="padding:14px 18px;border-top:1px solid #1c1c1c;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="eyebrow" id="txCount">—</span>
          <span class="eyebrow" id="totals">—</span>
        </div>
      </div>
    `;

    root.querySelector('#newTxBtn').addEventListener('click', () => this.openModal());
    root.querySelector('#filtersForm').addEventListener('submit', (e) => {
      e.preventDefault();
      state.filters = this.readFilters(root);
      this.load(root);
    });
    root.querySelector('#f-clear').addEventListener('click', () => {
      state.filters = { type: '', categoryId: '', accountId: '', from: '', to: '', search: '' };
      root.querySelectorAll('#filtersForm input, #filtersForm select').forEach((el) => (el.value = ''));
      this.load(root);
    });

    this.applyFiltersToInputs(root);
    await this.load(root);
  },

  readFilters(root) {
    return {
      from: root.querySelector('#f-from').value,
      to: root.querySelector('#f-to').value,
      type: root.querySelector('#f-type').value,
      categoryId: root.querySelector('#f-category').value,
      accountId: root.querySelector('#f-account').value,
      search: root.querySelector('#f-search').value.trim()
    };
  },

  applyFiltersToInputs(root) {
    root.querySelector('#f-from').value = state.filters.from;
    root.querySelector('#f-to').value = state.filters.to;
    root.querySelector('#f-type').value = state.filters.type;
    root.querySelector('#f-category').value = state.filters.categoryId;
    root.querySelector('#f-account').value = state.filters.accountId;
    root.querySelector('#f-search').value = state.filters.search;
  },

  async load(root) {
    const body = root.querySelector('#txBody');
    body.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty__num">…</div><p>Cargando</p></div></td></tr>';
    try {
      const { rows, total } = await apiClient.get(`/transactions${makeQuery({ ...state.filters, limit: 500 })}`);
      root.querySelector('#txCount').textContent = `${total} movimientos`;
      const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      root.querySelector('#totals').textContent = `Ingresos $${income.toLocaleString('es-AR')} · Gastos $${expenses.toLocaleString('es-AR')}`;

      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty__num">0</div><p>Sin movimientos que coincidan con los filtros.</p></div></td></tr>';
        return;
      }

      body.innerHTML = rows
        .map(
          (t) => `
        <tr data-id="${t.id}">
          <td class="mono text-mid" style="white-space:nowrap">${fmtDate(t.date)}</td>
          <td style="max-width:260px">${t.description || '<span class="text-mid">—</span>'}</td>
          <td>
            ${t.categoryName ? `<span class="dot" style="background:${t.categoryColor || '#7a7a7a'}"></span><span>${t.categoryName}</span>` : '<span class="text-mid">—</span>'}
          </td>
          <td class="text-mid">${t.accountName}</td>
          <td>${t.type === 'income' ? '<span class="chip chip--income">Ingreso</span>' : '<span class="chip chip--expense">Gasto</span>'}
          <td class="mono amount-${t.type}" style="text-align:right;white-space:nowrap">${t.type === 'income' ? '+' : '−'} ${moneyWithCurrency(t.amount, { sign: false })}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="icon-btn tx-edit" data-id="${t.id}" title="Editar">✎</button>
            <button class="icon-btn icon-btn--danger tx-del" data-id="${t.id}" title="Eliminar">✕</button>
          </td>
        </tr>`
        )
        .join('');

      body.querySelectorAll('.tx-edit').forEach((b) =>
        b.addEventListener('click', () => this.openModal(rows.find((t) => t.id === b.dataset.id)))
      );
      body.querySelectorAll('.tx-del').forEach((b) =>
        b.addEventListener('click', () => this.remove(rows.find((t) => t.id === b.dataset.id)))
      );
    } catch (err) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty__num">×</div><p>${err.message}</p></div></td></tr>`;
    }
  },

  categoryOptions(type, selectedId) {
    const opts = ['<option value="">Sin categoría</option>'];
    state.categories
      .filter((c) => c.type === type)
      .forEach((c) => opts.push(`<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`));
    opts.push('<option value="__new__">＋ Nueva categoría…</option>');
    return opts.join('');
  },

  openModal(tx = null) {
    const isEdit = !!tx;
    const { el, close } = openModal({
      title: tx ? 'Editar movimiento' : 'Nuevo movimiento',
      size: 'modal--lg',
      bodyHtml: `
        <form id="txForm">
          <div class="form-grid">
            <div class="field">
              <label>Tipo</label>
              <select class="select" id="tx-type" required>
                <option value="expense" ${tx?.type === 'expense' ? 'selected' : ''}>Gasto</option>
                <option value="income" ${tx?.type === 'income' ? 'selected' : ''}>Ingreso</option>
              </select>
            </div>
            <div class="field">
              <label>Fecha</label>
              <input class="input input--mono" type="date" id="tx-date" value="${tx?.date || todayISO()}" required />
            </div>
            <div class="field">
              <label>Cuenta</label>
              <select class="select" id="tx-account" required>
                ${state.accounts.map((a) => `<option value="${a.id}" ${tx?.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Categoría</label>
              <select class="select" id="tx-category">${this.categoryOptions(tx?.type || 'expense', tx?.categoryId)}</select>
              <div id="tx-new-cat" style="display:none;margin-top:10px">
                <div class="form-grid" style="gap:8px">
                  <div class="field">
                    <input class="input" id="tx-cat-name" placeholder="Nombre de la nueva categoría" maxlength="40" />
                  </div>
                  <div class="field" style="display:flex;align-items:center;gap:10px">
                    <input class="input input--mono" type="color" id="tx-cat-color" value="#c7f13a" style="width:52px;height:38px;padding:3px;background:transparent" />
                    <button class="btn btn--sm btn--solid" type="button" id="tx-cat-create">Crear</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="field">
              <label>Monto</label>
              <input class="input input--mono" type="number" step="0.01" min="0.01" id="tx-amount" value="${tx?.amount ?? ''}" placeholder="0.00" required />
            </div>
            <div class="field field--full">
              <label>Descripción</label>
              <input class="input" id="tx-description" value="${tx?.description ?? ''}" placeholder="Ej.: Supermercado semanal, sueldo…" maxlength="300" />
            </div>
          </div>
        </form>`,
      footerHtml: `
        <button class="btn btn--ghost" id="tx-cancel">Cancelar</button>
        <button class="btn btn--solid" id="tx-save">${isEdit ? 'Guardar cambios' : 'Registrar'}</button>`
    });

    const typeSel = el.querySelector('#tx-type');
    const catSel = el.querySelector('#tx-category');
    const newCatBox = el.querySelector('#tx-new-cat');

    typeSel.addEventListener('change', () => {
      catSel.innerHTML = this.categoryOptions(typeSel.value, null);
      newCatBox.style.display = 'none';
    });
    catSel.addEventListener('change', () => {
      newCatBox.style.display = catSel.value === '__new__' ? 'block' : 'none';
    });
    el.querySelector('#tx-cancel').addEventListener('click', close);

    el.querySelector('#tx-cat-create').addEventListener('click', async () => {
      const name = el.querySelector('#tx-cat-name').value.trim();
      if (!name) return notifyError('Ingresá el nombre de la nueva categoría.');
      const color = el.querySelector('#tx-cat-color').value;
      try {
        const cat = await apiClient.post('/categories', { name, type: typeSel.value, color });
        state.categories.push(cat);
        catSel.innerHTML = this.categoryOptions(typeSel.value, cat.id);
        newCatBox.style.display = 'none';
        const fCats = document.querySelector('#f-category');
        if (fCats && ![...fCats.options].some((o) => o.value === cat.id)) {
          fCats.insertAdjacentHTML('beforeend', `<option value="${cat.id}">${cat.name}</option>`);
        }
        toast(`Categoría "${cat.name}" creada.`);
      } catch (err) {
        notifyError(err.message);
      }
    });

    el.querySelector('#tx-save').addEventListener('click', async () => {
      const catValue = el.querySelector('#tx-category').value;
      if (catValue === '__new__') return notifyError('Creá la nueva categoría antes de registrar el movimiento.');
      const payload = {
        type: typeSel.value,
        date: el.querySelector('#tx-date').value,
        accountId: el.querySelector('#tx-account').value,
        categoryId: catValue || null,
        amount: el.querySelector('#tx-amount').value,
        description: el.querySelector('#tx-description').value
      };
      if (!payload.date || !payload.amount || !payload.accountId) return notifyError('Completa fecha, cuenta y monto.');
      try {
        if (isEdit) await apiClient.put(`/transactions/${tx.id}`, payload);
        else await apiClient.post('/transactions', payload);
        toast(isEdit ? 'Movimiento actualizado.' : 'Movimiento registrado.');
        close();
        this.load(document.querySelector('#view'));
      } catch (err) {
        notifyError(err.message);
      }
    });

    el.addEventListener('submit', (e) => e.preventDefault());
  },

  async remove(tx) {
    const ok = await confirmAction({ title: 'Eliminar movimiento', text: `¿Eliminar "${tx.description || tx.id}" por $${tx.amount}?` });
    if (!ok) return;
    try {
      await apiClient.del(`/transactions/${tx.id}`);
      toast('Movimiento eliminado.');
      this.load(document.querySelector('#view'));
    } catch (err) {
      notifyError(err.message);
    }
  }
};