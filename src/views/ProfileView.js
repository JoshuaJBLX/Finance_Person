import { apiClient } from '../api.js';
import { store } from '../store.js';
import { destroyAll } from '../utils/charts.js';
import { toast, notifyError } from '../utils/ui.js';
import { initials } from '../utils/format.js';

export const ProfileView = {
  mount(root) {
    destroyAll();
    const user = store.user;

    root.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow eyebrow--lime">Cuenta</div>
          <h1 class="display">Perfil</h1>
        </div>
        <div class="stamp-num">${user.role === 'admin' ? 'Administrador' : 'Usuario estándar'}</div>
      </header>

      <div class="grid grid--2">
        <section class="panel panel--lime-edge">
          <div class="panel__head"><div class="panel__title">Datos personales</div></div>
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px">
            <div class="avatar avatar--lime" style="width:64px;height:64px;font-size:22px">${initials(`${user.firstName} ${user.lastName}`)}</div>
            <div>
              <div style="font-weight:700;font-size:18px">${user.firstName} ${user.lastName}</div>
              <div class="mono" style="font-size:12px;color:var(--gray-mid)">${user.email}</div>
            </div>
          </div>
          <form id="profileForm">
            <div class="form-grid">
              <div class="field"><label>Nombre</label><input class="input" id="p-first" value="${user.firstName}" required /></div>
              <div class="field"><label>Apellido</label><input class="input" id="p-last" value="${user.lastName}" required /></div>
            </div>
            <button class="btn btn--solid" type="submit" id="p-save">Guardar cambios</button>
          </form>
        </section>

        <section class="panel">
          <div class="panel__head"><div class="panel__title">Seguridad</div></div>
          <form id="passForm">
            <div class="field">
              <label>Contraseña actual</label>
              <input class="input" type="password" id="p-current" required autocomplete="current-password" />
            </div>
            <div class="field">
              <label>Nueva contraseña · mín. 8 (letras y números)</label>
              <input class="input" type="password" id="p-new" required autocomplete="new-password" />
            </div>
            <div class="field">
              <label>Repetir nueva contraseña</label>
              <input class="input" type="password" id="p-new2" required autocomplete="new-password" />
            </div>
            <button class="btn" type="submit" id="pass-save">Cambiar contraseña</button>
          </form>
        </section>
      </div>
    `;

    root.querySelector('#profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('#p-save');
      btn.disabled = true;
      try {
        const updated = await apiClient.put('/users/me', {
          firstName: root.querySelector('#p-first').value,
          lastName: root.querySelector('#p-last').value
        });
        store.updateUser(updated);
        toast('Perfil actualizado.');
      } catch (err) {
        notifyError(err.message);
      } finally {
        btn.disabled = false;
      }
    });

    root.querySelector('#passForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = root.querySelector('#p-new').value;
      const p2 = root.querySelector('#p-new2').value;
      if (p1 !== p2) return notifyError('Las contraseñas no coinciden.');
      const btn = e.target.querySelector('#pass-save');
      btn.disabled = true;
      try {
        await apiClient.put('/users/me', {
          currentPassword: root.querySelector('#p-current').value,
          newPassword: p1
        });
        toast('Contraseña actualizada.');
        e.target.reset();
      } catch (err) {
        notifyError(err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }
};