import { apiClient } from '../api.js';
import { store } from '../store.js';
import { toast, notifyError, alertInfo } from '../utils/ui.js';

const MODE_COPY = {
  login: { title: 'Acceso', sub: 'Inicia sesión con tu cuenta', btn: 'Entrar' },
  register: { title: 'Crear cuenta', sub: 'Tu espacio financiero empieza aquí', btn: 'Registrarme' },
  forgot: { title: 'Recuperar acceso', sub: 'Generamos un enlace de recuperación', btn: 'Generar enlace' },
  reset: { title: 'Nueva contraseña', sub: 'Define una contraseña segura', btn: 'Restablecer' }
};

const posters = {
  login: ['Control total.', 'Finanzas claras.', 'Sin ruido.'],
  register: ['Empieza hoy.', 'Tu dinero, bien medido.', 'Sin ruido.'],
  forgot: ['Acceso seguro.', 'Recuperación simple.', 'Sin ruido.'],
  reset: ['Nueva etapa.', 'Contraseña segura.', 'Sin ruido.']
};

export const AuthView = {
  mount(root, { mode = 'login', param = '' }) {
    const copy = MODE_COPY[mode] || MODE_COPY.login;
    const poster = posters[mode] || posters.login;

    root.innerHTML = `
      <div class="auth">
        <section class="auth__poster">
          <div class="auth__brand">
            <img src="/FP_LOGO.png" alt="Finance Person" />
            <span class="auth__brand-name">Finance <em>Person</em></span>
          </div>

          <div class="auth__headline">
            <div class="eyebrow eyebrow--lime mb-0">Dashboard de finanzas personales</div>
            <h1>
              ${poster.map((l) => `<span class="line">${l}</span>`).join('')}
            </h1>
            <p>Registra ingresos y gastos, define presupuestos y descubre tus hábitos de consumo con una plataforma segura, multiusuario y simple.</p>
          </div>

          <div class="eyebrow">Hecho con precisión · MongoDB Atlas · Node.js · SaaS</div>
        </section>

        <section class="auth__form-side">
          <div class="auth__card">
            <h2>${copy.title}</h2>
            <p class="auth__sub">${copy.sub}</p>
            <div id="authForm"></div>
          </div>
        </section>
      </div>
    `;

    const formHost = root.querySelector('#authForm');
    if (mode === 'login') this.login(formHost, root);
    else if (mode === 'register') this.register(formHost, root);
    else if (mode === 'forgot') this.forgot(formHost, root);
    else if (mode === 'reset') this.reset(formHost, root, param);
  },

  linkBack() {
    return `<p class="auth__alt">¿<a href="#/login">Iniciar sesión</a></p>`;
  },

  login(host) {
    host.innerHTML = `
      <form id="loginForm" novalidate>
        <div class="field">
          <label for="email">Correo</label>
          <input class="input" type="email" id="email" name="email" placeholder="tu@correo.com" required autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input class="input" type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password" />
        </div>
        <div style="text-align:right;margin-bottom:18px">
          <a href="#/forgot" style="font-size:12.5px">¿Olvidaste tu contraseña?</a>
        </div>
        <button class="btn btn--solid btn--block" type="submit" id="loginBtn">Entrar</button>
      </form>
      <p class="auth__alt">¿No tienes cuenta? <a href="#/register">Regístrate</a></p>
      <p class="auth__alt" style="margin-top:10px">
        <a href="#/register" data-demo style="color:var(--gray-mid);font-family:var(--font-mono);font-size:12px">Probar cuenta demo</a>
      </p>
    `;

    host.querySelector('[data-demo]')?.addEventListener('click', (e) => {
      e.preventDefault();
      host.querySelector('#email').value = 'demo@finance.person';
      host.querySelector('#password').value = 'Demo12345';
      host.querySelector('#loginForm').requestSubmit();
    });

    host.querySelector('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = host.querySelector('#loginBtn');
      btn.disabled = true;
      btn.textContent = 'Entrando…';
      try {
        const { user, token } = await apiClient.post('/auth/login', {
          email: host.querySelector('#email').value,
          password: host.querySelector('#password').value
        });
        store.login(user, token);
        apiClient.setToken(token);
        toast(`Bienvenido, ${user.firstName}`);
        location.hash = '#/dashboard';
      } catch (err) {
        notifyError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    });
  },

  register(host) {
    host.innerHTML = `
      <form id="regForm" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="firstName">Nombre</label>
            <input class="input" id="firstName" required placeholder="María" autocomplete="given-name" />
          </div>
          <div class="field">
            <label for="lastName">Apellido</label>
            <input class="input" id="lastName" required placeholder="López" autocomplete="family-name" />
          </div>
        </div>
        <div class="field">
          <label for="regEmail">Correo</label>
          <input class="input" type="email" id="regEmail" required placeholder="tu@correo.com" autocomplete="email" />
        </div>
        <div class="field">
          <label for="regPassword">Contraseña · mín. 8 (letras y números)</label>
          <input class="input" type="password" id="regPassword" required placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="regPassword2">Repetir contraseña</label>
          <input class="input" type="password" id="regPassword2" required placeholder="••••••••" autocomplete="new-password" />
        </div>
        <button class="btn btn--solid btn--block" type="submit" id="regBtn">Crear cuenta</button>
      </form>
      ${this.linkBack()}
    `;

    host.querySelector('#regForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = host.querySelector('#firstName').value;
      const lastName = host.querySelector('#lastName').value;
      const email = host.querySelector('#regEmail').value;
      const password = host.querySelector('#regPassword').value;
      const password2 = host.querySelector('#regPassword2').value;
      if (password !== password2) return notifyError('Las contraseñas no coinciden.');

      const btn = host.querySelector('#regBtn');
      btn.disabled = true;
      btn.textContent = 'Creando…';
      try {
        const { user, token } = await apiClient.post('/auth/register', { firstName, lastName, email, password });
        store.login(user, token);
        apiClient.setToken(token);
        toast(`Cuenta creada. ¡Hola, ${user.firstName}!`);
        location.hash = '#/dashboard';
      } catch (err) {
        notifyError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Crear cuenta';
      }
    });
  },

  forgot(host) {
    host.innerHTML = `
      <form id="forgotForm" novalidate>
        <div class="field">
          <label for="forgotEmail">Correo</label>
          <input class="input" type="email" id="forgotEmail" required placeholder="tu@correo.com" />
        </div>
        <button class="btn btn--solid btn--block" type="submit" id="forgotBtn">Generar enlace</button>
      </form>
      <p class="auth__alt"><a href="#/login">Volver a inicio de sesión</a></p>
    `;

    host.querySelector('#forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = host.querySelector('#forgotBtn');
      btn.disabled = true;
      btn.textContent = 'Generando…';
      try {
        const res = await apiClient.post('/auth/forgot-password', {
          email: host.querySelector('#forgotEmail').value
        });
        alertInfo({
          title: 'Enlace generado',
          icon: 'info',
          html: `<p>En entorno <b>demo</b> (sin SMTP), tu token de recuperación es:</p>
                 <p class="mono" style="word-break:break-all;color:var(--lime)">${res.token}</p>
                 <p><a href="#/reset/${res.token}">Ir a restablecer contraseña</a></p>`
        });
      } catch (err) {
        notifyError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generar enlace';
      }
    });
  },

  reset(host, root, tokenParam) {
    const token = tokenParam || new URLSearchParams(location.hash.split('?')[1]).get('token') || '';

    const renderForm = () => {
      if (!token) {
        host.innerHTML = `
          <div class="empty">
            <div class="empty__num">!</div>
            <p>URL de recuperación inválida.<br/><a href="#/forgot">Genera un nuevo enlace</a></p>
          </div>`;
        return;
      }
      host.innerHTML = `
        <form id="resetForm" novalidate>
          <div class="field">
            <label for="newPass">Nueva contraseña · mín. 8 (letras y números)</label>
            <input class="input" type="password" id="newPass" required />
          </div>
          <div class="field">
            <label for="newPass2">Repetir contraseña</label>
            <input class="input" type="password" id="newPass2" required />
          </div>
          <button class="btn btn--solid btn--block" type="submit" id="resetBtn">Restablecer</button>
        </form>
        <p class="auth__alt"><a href="#/login">Volver a inicio de sesión</a></p>
      `;

      host.querySelector('#resetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const p1 = host.querySelector('#newPass').value;
        const p2 = host.querySelector('#newPass2').value;
        if (p1 !== p2) return notifyError('Las contraseñas no coinciden.');
        const btn = host.querySelector('#resetBtn');
        btn.disabled = true;
        btn.textContent = 'Restableciendo…';
        try {
          await apiClient.post('/auth/reset-password', { token, password: p1 });
          toast('Contraseña actualizada. Inicia sesión.');
          location.hash = '#/login';
        } catch (err) {
          notifyError(err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Restablecer';
        }
      });
    };

    if (token) {
      apiClient.get(`/auth/verify-reset${token ? `?token=${encodeURIComponent(token)}` : ''}`).catch(() => {});
    }
    renderForm();
  }
};