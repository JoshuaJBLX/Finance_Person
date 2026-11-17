import { apiClient, makeQuery } from '../api.js';
import { moneyWithCurrency, fmtDate, initials, todayISO } from '../utils/format.js';
import { destroyAll } from '../utils/charts.js';
import { openModal, toast, notifyError, confirmAction } from '../utils/ui.js';

/** Root montado actualmente; usada por el refresco en vivo (evento fp:data-changed). */
let liveRoot = null;
let refreshTimer = null;

function onDataChanged() {
  if (!liveRoot || !liveRoot.isConnected) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => AdminView.mount(liveRoot), 120);
}
window.addEventListener('fp:data-changed', onDataChanged);

export const AdminView = {
  async mount(root) {
    destroyAll();
    liveRoot = root;
    const [stats, usersRes, sysCats] = await Promise.all([
      apiClient.get('/admin/stats').catch(() => null),
      apiClient.get('/admin/users?limit=100').catch(() => null),
      apiClient.get('/admin/categories/system').catch(() => null)
    ]);

    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Control total</div>
          <h1 class="display">Administración</h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--solid" id="adminAddTx">+ Nuevo movimiento</button>
          <button class="btn" id="adminRefresh">↻ Actualizar</button>
          <span class="stamp-num">RBAC · Admin</span>
        </div>
      </header>

      <div class="grid grid--stats" style="margin-bottom:24px">
        <div class="stat stat--accent"><div class="stat__label">Usuarios</div><div class="stat__value" id="aUsers">—</div></div>
        <div class="stat"><div class="stat__label">Movimientos</div><div class="stat__value" id="aTx">—</div></div>
        <div class="stat"><div class="stat__label">Ingresos globales</div><div class="stat__value" id="aIncome">—</div></div>
        <div class="stat"><div class="stat__label">Gastos globales</div><div class="stat__value" id="aExpenses">—</div></div>
        <div class="stat"><div class="stat__label">Cuentas</div><div class="stat__value" id="aAccounts">—</div></div>
        <div class="stat"><div class="stat__label">Categorías</div><div class="stat__value" id="aCategories">—</div></div>
      </div>

      <div class="grid grid--2">
        <section class="panel">
          <div class="panel__head"><div class="panel__title">Usuarios</div></div>
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input class="input" id="userSearch" placeholder="Buscar por correo o nombre…" />
            <button class="btn" id="userSearchBtn">Buscar</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Registro</th><th></th></tr></thead>
              <tbody id="userBody"></tbody>
            </table>
          </div>
        </section>

        <section class="panel panel--lime-edge">
          <div class="panel__head">
            <div class="panel__title">Categorías del sistema</div>
            <button class="btn btn--sm btn--solid" id="sysCatAdd">+ Añadir</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Nombre</th><th>Tipo</th><th></th></tr></thead>
              <tbody id="sysCatBody"></tbody>
            </table>
          </div>
          <p class="text-mid" style="font-size:12px;margin-top:12px">Visibles para todos los usuarios del sistema (multiinquilino).</p>
        </section>
      </div>
    `;

    if (stats) {
      root.querySelector('#aUsers').textContent = stats.users ?? '—';
      root.querySelector('#aTx').textContent = stats.transactions ?? '—';
      root.querySelector('#aIncome').textContent = moneyWithCurrency(stats.income);
      root.querySelector('#aExpenses').textContent = moneyWithCurrency(stats.expenses);
      root.querySelector('#aAccounts').textContent = stats.accounts ?? '—';
      root.querySelector('#aCategories').textContent = stats.categories ?? '—';
    }

    this.renderUsers(root, usersRes?.rows || []);
    this.renderSysCats(root, sysCats || []);

    root.querySelector('#userSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchUsers(root);
    });
    root.querySelector('#userSearchBtn').addEventListener('click', () => this.searchUsers(root));
    root.querySelector('#sysCatAdd').addEventListener('click', () => this.sysCatModal());
    root.querySelector('#adminRefresh').addEventListener('click', () => this.mount(root));
    root.querySelector('#adminAddTx').addEventListener('click', () => this.quickAddTxModal(root));
  },

  async quickAddTxModal(root) {
    const [accounts, categories] = await Promise.all([
      apiClient.get('/accounts').catch(() => []),
      apiClient.get('/categories').catch(() => [])
    ]);
    if (!accounts.length) {
      return notifyError('Primero creá una cuenta en la sección Cuentas.');
    }
    const catOpts = (type, sel) =>
      [`<option value="">Sin categoría</option>`]
        .concat(
          categories
            .filter((c) => c.type === type)
            .map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.name}</option>`)
        )
        .concat('<option value="__new__">＋ Nueva categoría…</option>')
        .join('');

    const { el, close } = openModal({
      title: 'Nuevo movimiento (admin)',
      size: 'modal--lg',
      bodyHtml: `
        <form id="admTxForm">
          <div class="form-grid">
            <div class="field">
              <label>Tipo</label>
              <select class="select" id="adm-type" required>
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>
            <div class="field">
              <label>Fecha</label>
              <input class="input input--mono" type="date" id="adm-date" value="${todayISO()}" required />
            </div>
            <div class="field">
              <label>Cuenta</label>
              <select class="select" id="adm-account" required>
                ${accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Categoría</label>
              <select class="select" id="adm-category">${catOpts('expense')}</select>
              <div id="adm-new-cat" style="display:none;margin-top:10px">
                <div class="form-grid" style="gap:8px">
                  <div class="field">
                    <input class="input" id="adm-cat-name" placeholder="Nombre de la nueva categoría" maxlength="40" />
                  </div>
                  <div class="field" style="display:flex;align-items:center;gap:10px">
                    <input class="input input--mono" type="color" id="adm-cat-color" value="#c7f13a" style="width:52px;height:38px;padding:3px;background:transparent" />
                    <button class="btn btn--sm btn--solid" type="button" id="adm-cat-create">Crear</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="field">
              <label>Monto</label>
              <input class="input input--mono" type="number" step="0.01" min="0.01" id="adm-amount" placeholder="0.00" required />
            </div>
            <div class="field field--full">
              <label>Descripción</label>
              <input class="input" id="adm-description" placeholder="Ej.: Nómina, supermercado…" maxlength="300" />
            </div>
          </div>
        </form>`,
      footerHtml: `
        <button class="btn btn--ghost" id="adm-cancel">Cancelar</button>
        <button class="btn btn--solid" id="adm-save">Registrar</button>`
    });

    const typeSel = el.querySelector('#adm-type');
    const catSel = el.querySelector('#adm-category');
    const newCatBox = el.querySelector('#adm-new-cat');

    typeSel.addEventListener('change', () => {
      catSel.innerHTML = catOpts(typeSel.value);
      newCatBox.style.display = 'none';
    });
    catSel.addEventListener('change', () => {
      newCatBox.style.display = catSel.value === '__new__' ? 'block' : 'none';
    });
    el.querySelector('#adm-cancel').addEventListener('click', close);

    el.querySelector('#adm-cat-create').addEventListener('click', async () => {
      const name = el.querySelector('#adm-cat-name').value.trim();
      if (!name) return notifyError('Ingresá el nombre de la nueva categoría.');
      const color = el.querySelector('#adm-cat-color').value;
      try {
        const cat = await apiClient.post('/categories', { name, type: typeSel.value, color });
        categories.push(cat);
        catSel.innerHTML = catOpts(typeSel.value, cat.id);
        newCatBox.style.display = 'none';
        toast(`Categoría "${cat.name}" creada.`);
      } catch (err) {
        notifyError(err.message);
      }
    });

    el.querySelector('#adm-save').addEventListener('click', async () => {
      const catValue = el.querySelector('#adm-category').value;
      if (catValue === '__new__') return notifyError('Creá la nueva categoría antes de registrar el movimiento.');
      const payload = {
        type: typeSel.value,
        date: el.querySelector('#adm-date').value,
        accountId: el.querySelector('#adm-account').value,
        categoryId: catValue || null,
        amount: el.querySelector('#adm-amount').value,
        description: el.querySelector('#adm-description').value
      };
      if (!payload.date || !payload.amount || !payload.accountId) return notifyError('Completá fecha, cuenta y monto.');
      try {
        await apiClient.post('/transactions', payload);
        toast('Movimiento registrado. Estadísticas actualizadas.');
        close();
        this.mount(root);
      } catch (err) {
        notifyError(err.message);
      }
    });
    el.addEventListener('submit', (e) => e.preventDefault());
  },

  async searchUsers(root) {
    const search = root.querySelector('#userSearch').value.trim();
    const res = await apiClient.get(`/admin/users${makeQuery({ search, limit: 100 })}`).catch(() => null);
    if (res) this.renderUsers(root, res.rows);
  },

  renderUsers(root, users) {
    const body = root.querySelector('#userBody');
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="4"><span class="text-mid">Sin usuarios.</span></td></tr>';
      return;
    }
    body.innerHTML = users
      .map(
        (u) => `
      <tr data-id="${u.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="avatar ${u.role === 'admin' ? 'avatar--lime' : ''}">${initials(`${u.firstName} ${u.lastName}`)}</span>
            <div>
              <div style="font-weight:600;font-size:13.5px">${u.firstName} ${u.lastName}</div>
              <div class="mono" style="font-size:11.5px;color:var(--gray-mid)">${u.email}</div>
            </div>
          </div>
        </td>
        <td>${u.role === 'admin' ? '<span class="chip chip--admin">Admin</span>' : '<span class="chip">User</span>'}</td>
        <td class="mono text-mid">${fmtDate(u.createdAt)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="icon-btn user-view" data-id="${u.id}" title="Ver movimientos">▤</button>
          ${u.role !== 'admin' ? `<button class="icon-btn icon-btn--danger user-del" data-id="${u.id}" title="Eliminar usuario">✕</button>` : ''}
        </td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('.user-view').forEach((b) =>
      b.addEventListener('click', () => this.userDetail(users.find((u) => u.id === b.dataset.id)))
    );
    body.querySelectorAll('.user-del').forEach((b) =>
      b.addEventListener('click', () => this.removeUser(b.dataset.id))
    );
  },

  renderSysCats(root, cats) {
    const body = root.querySelector('#sysCatBody');
    if (!cats.length) {
      body.innerHTML = '<tr><td colspan="3"><span class="text-mid">Sin categorías del sistema.</span></td></tr>';
      return;
    }
    body.innerHTML = cats
      .map(
        (c) => `
      <tr data-id="${c.id}">
        <td><span class="dot" style="background:${c.color}"></span>${c.name}</td>
        <td>${c.type === 'income' ? '<span class="chip chip--income">Ingreso</span>' : '<span class="chip chip--expense">Gasto</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="icon-btn sys-edit" data-id="${c.id}">✎</button>
          <button class="icon-btn icon-btn--danger sys-del" data-id="${c.id}">✕</button>
        </td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('.sys-edit').forEach((b) =>
      b.addEventListener('click', () => this.sysCatModal(cats.find((c) => c.id === b.dataset.id)))
    );
    body.querySelectorAll('.sys-del').forEach((b) =>
      b.addEventListener('click', () => this.removeSysCat(b.dataset.id))
    );
  },

  async userDetail(user) {
    try {
      const { transactions, summary } = await apiClient.get(`/admin/users/${user.id}/transactions`);
      const income = summary?.income || 0;
      const expenses = summary?.expenses || 0;
      const { el, close } = openModal({
        title: `${user.firstName} ${user.lastName}`,
        size: 'modal--lg',
        bodyHtml: `
          <div class="grid grid--stats" style="margin-bottom:18px">
            <div class="stat" style="min-height:90px"><div class="stat__label">Ingresos</div><div class="stat__value" style="font-size:20px">${moneyWithCurrency(income)}</div></div>
            <div class="stat" style="min-height:90px"><div class="stat__label">Gastos</div><div class="stat__value" style="font-size:20px">${moneyWithCurrency(expenses)}</div></div>
            <div class="stat stat--accent" style="min-height:90px"><div class="stat__label">Balance</div><div class="stat__value" style="font-size:20px">${moneyWithCurrency(income - expenses)}</div></div>
          </div>
          <div class="table-wrap" style="max-height:320px;overflow-y:auto">
            <table class="table">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th style="text-align:right">Monto</th></tr></thead>
              <tbody>
                ${transactions.slice(0, 60).map((t) => `
                  <tr>
                    <td class="mono text-mid">${fmtDate(t.date)}</td>
                    <td>${t.description || '—'}</td>
                    <td>${t.type === 'income' ? '<span class="chip chip--income">Ingreso</span>' : '<span class="chip chip--expense">Gasto</span>'}</td>
                    <td class="mono amount-${t.type}" style="text-align:right">${moneyWithCurrency(t.amount)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `,
        footerHtml: `<button class="btn" id="ud-close">Cerrar</button>`
      });
      el.querySelector('#ud-close').addEventListener('click', close);
    } catch (err) {
      notifyError(err.message);
    }
  },

  async removeUser(id) {
    const ok = await confirmAction({ title: 'Eliminar usuario', text: 'Se eliminará la cuenta y todos sus datos de forma permanente (cascade).' });
    if (!ok) return;
    try {
      await apiClient.del(`/admin/users/${id}`);
      toast('Usuario eliminado.');
      this.searchUsers(document.querySelector('#view'));
    } catch (err) {
      notifyError(err.message);
    }
  },

  sysCatModal(cat = null) {
    const isEdit = !!cat;
    const { el, close } = openModal({
      title: cat ? 'Editar categoría del sistema' : 'Categoría del sistema',
      size: 'modal--sm',
      bodyHtml: `
        <form id="sysForm">
          <div class="field"><label>Nombre</label><input class="input" id="s-name" value="${cat?.name ?? ''}" required /></div>
          <div class="field">
            <label>Tipo</label>
            <select class="select" id="s-type" ${isEdit ? 'disabled' : ''}>
              <option value="expense" ${cat?.type === 'expense' ? 'selected' : ''}>Gasto</option>
              <option value="income" ${cat?.type === 'income' ? 'selected' : ''}>Ingreso</option>
            </select>
          </div>
          <div class="field"><label>Color</label><input class="input input--mono" type="color" id="s-color" value="${cat?.color || '#c7f13a'}" style="width:60px;height:42px;padding:3px;background:transparent" /></div>
        </form>`,
      footerHtml: `
        <button class="btn btn--ghost" id="s-cancel">Cancelar</button>
        <button class="btn btn--solid" id="s-save">${isEdit ? 'Guardar' : 'Crear'}</button>`
    });

    el.querySelector('#s-cancel').addEventListener('click', close);
    el.querySelector('#s-save').addEventListener('click', async () => {
      const payload = {
        name: el.querySelector('#s-name').value,
        type: el.querySelector('#s-type').value,
        color: el.querySelector('#s-color').value
      };
      try {
        if (isEdit) await apiClient.put(`/admin/categories/system/${cat.id}`, { name: payload.name, color: payload.color });
        else await apiClient.post('/admin/categories/system', payload);
        toast(isEdit ? 'Categoría del sistema actualizada.' : 'Categoría del sistema creada.');
        close();
        this.mount(document.querySelector('#view'));
      } catch (err) {
        notifyError(err.message);
      }
    });
    el.addEventListener('submit', (e) => e.preventDefault());
  },

  async removeSysCat(id) {
    const ok = await confirmAction({ title: 'Eliminar categoría del sistema', text: 'Esta categoría dejará de estar disponible para todos los usuarios.' });
    if (!ok) return;
    try {
      await apiClient.del(`/admin/categories/system/${id}`);
      toast('Categoría eliminada.');
      this.mount(document.querySelector('#view'));
    } catch (err) {
      notifyError(err.message);
    }
  }
};