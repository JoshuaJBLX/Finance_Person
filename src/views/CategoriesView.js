import { apiClient } from '../api.js';
import { store } from '../store.js';
import { destroyAll } from '../utils/charts.js';
import { openModal, toast, notifyError, confirmAction } from '../utils/ui.js';

export const CategoriesView = {
  async mount(root) {
    destroyAll();
    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Clasificación</div>
          <h1 class="display">Categorías</h1>
        </div>
        <button class="btn btn--solid" id="newCatBtn">+ Nueva categoría</button>
      </header>

      <div class="grid grid--2">
        <section class="panel panel--lime-edge">
          <div class="panel__head">
            <div class="panel__title">Ingresos</div>
            <span class="eyebrow" id="countIncome">0</span>
          </div>
          <ul class="icon-list" id="incomeList"></ul>
        </section>
        <section class="panel">
          <div class="panel__head">
            <div class="panel__title">Gastos</div>
            <span class="eyebrow" id="countExpense">0</span>
          </div>
          <ul class="icon-list" id="expenseList"></ul>
        </section>
      </div>

      <p class="auth__alt" style="margin-top:26px;text-align:left">
        <span class="text-mid" style="font-size:12.5px">Las categorías del sistema (visible para todos) solo pueden editarse desde el panel de administración.</span>
      </p>
    `;

    root.querySelector('#newCatBtn').addEventListener('click', () => this.openModal());
    await this.load(root);
  },

  async load(root) {
    const cats = (await apiClient.get('/categories').catch(() => [])) || [];
    const isAdmin = store.isAdmin;
    const income = cats.filter((c) => c.type === 'income');
    const expense = cats.filter((c) => c.type === 'expense');

    root.querySelector('#countIncome').textContent = `${income.length}`;
    root.querySelector('#countExpense').textContent = `${expense.length}`;

    const render = (list, suffix) => {
      const el = root.querySelector(`#${suffix}List`);
      if (!list.length) {
        el.innerHTML = '<li><span class="text-mid">Sin categorías.</span></li>';
        return;
      }
      el.innerHTML = list
        .map((c) => {
          const editable = c.isSystem ? isAdmin : true;
          return `
          <li>
            <span class="dot" style="background:${c.color}"></span>
            <div class="icon-list__label">
              <div class="icon-list__name">${c.name} ${c.isSystem ? '<span class="chip chip--admin" style="margin-left:6px">Sistema</span>' : ''}</div>
              <div class="icon-list__meta">${c.type}</div>
            </div>
            ${editable ? `
            <button class="icon-btn cat-edit" data-id="${c.id}" title="Editar">✎</button>
            <button class="icon-btn icon-btn--danger cat-del" data-id="${c.id}" title="Eliminar">✕</button>` : ''}
          </li>`;
        })
        .join('');

      el.querySelectorAll('.cat-edit').forEach((b) =>
        b.addEventListener('click', () => this.openModal(list.find((c) => c.id === b.dataset.id)))
      );
      el.querySelectorAll('.cat-del').forEach((b) =>
        b.addEventListener('click', () => this.remove(list.find((c) => c.id === b.dataset.id)))
      );
    };

    render(income, 'income');
    render(expense, 'expense');
  },

  openModal(cat = null) {
    const isEdit = !!cat;
    const { el, close } = openModal({
      title: cat ? 'Editar categoría' : 'Nueva categoría',
      size: 'modal--sm',
      bodyHtml: `
        <form id="catForm">
          <div class="field">
            <label>Nombre</label>
            <input class="input" id="cat-name" value="${cat?.name ?? ''}" placeholder="Ej.: Alimentación" required />
          </div>
          <div class="field">
            <label>Tipo</label>
            <select class="select" id="cat-type" ${isEdit ? 'disabled' : ''}>
              <option value="expense" ${cat?.type === 'expense' ? 'selected' : ''}>Gasto</option>
              <option value="income" ${cat?.type === 'income' ? 'selected' : ''}>Ingreso</option>
            </select>
          </div>
          <div class="field">
            <label>Color</label>
            <div style="display:flex;gap:10px;align-items:center">
              <input class="input input--mono" type="color" id="cat-color" value="${cat?.color || '#c7f13a'}" style="width:54px;padding:4px;height:44px;background:transparent" />
              <input class="input input--mono" id="cat-color-hex" value="${cat?.color || '#C7F13A'}" style="max-width:120px" maxlength="7" />
            </div>
          </div>
        </form>`,
      footerHtml: `
        <button class="btn btn--ghost" id="cat-cancel">Cancelar</button>
        <button class="btn btn--solid" id="cat-save">${isEdit ? 'Guardar' : 'Crear'}</button>`
    });

    const colorInput = el.querySelector('#cat-color');
    const hexInput = el.querySelector('#cat-color-hex');
    colorInput.addEventListener('input', () => (hexInput.value = colorInput.value.toUpperCase()));
    hexInput.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) colorInput.value = hexInput.value;
    });

    el.querySelector('#cat-cancel').addEventListener('click', close);
    el.querySelector('#cat-save').addEventListener('click', async () => {
      const payload = {
        name: el.querySelector('#cat-name').value,
        type: el.querySelector('#cat-type').value,
        color: hexInput.value
      };
      try {
        if (isEdit) await apiClient.put(`/categories/${cat.id}`, { name: payload.name, color: payload.color });
        else await apiClient.post('/categories', payload);
        toast(isEdit ? 'Categoría actualizada.' : 'Categoría creada.');
        close();
        this.load(document.querySelector('#view'));
      } catch (err) {
        notifyError(err.message);
      }
    });
    el.addEventListener('submit', (e) => e.preventDefault());
  },

  async remove(cat) {
    const ok = await confirmAction({
      title: 'Eliminar categoría',
      text: `Se eliminará "${cat.name}". Los movimientos vinculados quedarán sin categoría.`
    });
    if (!ok) return;
    try {
      await apiClient.del(`/categories/${cat.id}`);
      toast('Categoría eliminada.');
      this.load(document.querySelector('#view'));
    } catch (err) {
      notifyError(err.message);
    }
  }
};