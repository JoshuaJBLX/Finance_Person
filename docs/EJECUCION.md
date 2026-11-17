# Guía de Ejecución

## 1. Requisitos previos

- **Node.js 18+** (probado con v24 y v25) — descargar en https://nodejs.org
- **npm 8+** (se incluye con Node.js)
- Navegador moderno (Chrome, Edge, Firefox)

> Si necesitas cambiar de versión de Node, usa **nvm-windows** (https://github.com/coreybutler/nvm-windows) o el **nvm** de sistemas Unix.

Verificar instalación:

```bash
node --version
npm --version
```

> **Windows — error típico al usar `npm` en PowerShell**:
>
> ```
> npm : No se puede cargar el archivo npm.ps1 porque la ejecución de scripts está deshabilitada…
> ```
>
> Es la **política de ejecución** de PowerShell bloqueando `npm.ps1` (no un error del proyecto). Dos soluciones:
>
> **A. Permitir scripts para el usuario actual (recomendado, una sola vez):**
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> npm run dev
> ```
>
> **B. Usar `npm.cmd` sin cambiar configuración:**
> ```powershell
> npm.cmd run dev
> ```
>
> **C. Evitar PowerShell por completo:** ejecutar el script incluido
> ```
> .\dev.bat
> ```
> (instala dependencias si hace falta y arranca dev/API).

## 2. Instalar dependencias

En la raíz del proyecto:

```bash
npm install
```

Instala dependencias de backend (Express, MongoDB, JWT…), frontend (Vite, Chart.js…) y de pruebas (jsdom para `test:ui`).

Alternativas:

```bash
npm ci        # instalación reproducible desde package-lock.json (no modifica versiones)
npm install   # instalación con resolución desde package.json
```

> **MongoDB Atlas** — crea un `.env` en la raíz con `MONGODB_URI` (y credenciales) antes de arrancar.
> El proyecto ya incluye un cluster M0 apuntando a la base `finance_person`. Sin esa variable,
> el driver intentará conectarse a `mongodb://127.0.0.1:27017` (fallará si no hay MongoDB local).

## 3. Modo desarrollo (recomendado)

```bash
npm.cmd run dev
```

> En PowerShell también funciona `npm run dev` si ya permitiste la ejecución de scripts (ver punto 1); en CMD/Git Bash se puede usar `npm run dev` directamente. Aquí se usa `npm.cmd` para que funcione en cualquier shell de Windows sin tocar la política de ejecución.

Ejecuta en paralelo:

| Servicio | URL | Descripción |
|---|---|---|
| **API REST** | http://localhost:4000/api | Express + MongoDB Atlas |
| **Frontend (Vite)** | http://localhost:5173 | Hot reload |

Abrir **http://localhost:5173** en el navegador.

- Vite **redirige** `/api/*` hacia la API (configurado en `vite.config.js`).
- La base de datos se crea y **siembra automáticamente** al arrancar la API (`server/config/seed.js`).

### Si algo falla

| Síntoma | Solución |
|---|---|
| `EADDRINUSE` en 4000 | Otra API en uso. Cambiar el puerto: `$env:PORT=4001; npm run dev:server` o cerrar el proceso |
| El puerto 5173 ocupado | Vite elige otro automáticamente (lo indica en consola) |
| Pantalla en blanco | Recompilar: `npm run build`; recargar con **Ctrl+F5** (caché) |
| Errores de importación | `npm install` de nuevo; borrar `node_modules` si persiste |
| `MongoServerError: querySrv ECONNREFUSED` / timeout | Revisa `MONGODB_URI` y que tu IP esté en el *Access List* de Atlas |

> Verifica que la API responda con **http://localhost:4000/api/health** → `{"status":"ok"}` y que Vite muestre la página en el arranque.

## 4. Modo producción

```bash
npm run build     # compila el frontend a dist/
npm start         # arranca el servidor (sirve dist/ + API)
```

Abrir **http://localhost:4000**.

- El servidor sirve la SPA compilada y la API; todo en el mismo origen.
- Un solo proceso: `node server/app.js`.

## 5. Base de datos

- Cluster: MongoDB Atlas **M0** (`Cluster0`), base `finance_person`.
- Conexión y índices en `server/config/database.js`; el driver es `mongodb` v6 (asíncrono).
- Al arrancar por primera vez se insertan automáticamente las cuentas demo y el administrador (ver [docs/USUARIOS.md](USUARIOS.md)).
- `npm run seed` regenera/repara los datasets de forma idempotente.
- Para **resetear**: borrar los documentos de las colecciones en Atlas (o usar `MONGODB_TEST_DB` con `NODE_ENV=test`).

## 6. Variables de entorno (opcional)

El servidor lee un archivo **`.env`** en la raíz del proyecto (vía `dotenv`) o variables del sistema:

| Variable | Default | Uso |
|---|---|---|
| `PORT` | `4000` | Puerto del servidor |
| `JWT_SECRET` | valor de desarrollo | Firma de tokens (**cambiar en producción**) |
| `NODE_ENV` | — | `production` = logs combinados + sirve `dist/` |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Cadena de conexión a Atlas |
| `MONGODB_DB` | `finance_person` | Nombre de la base de datos |
| `MONGODB_TEST_DB` | `finance_person_test` | Base efímera para pruebas |

Ejemplo de `.env`:

```
PORT=4000
JWT_SECRET=pon-un-secreto-largo-y-único-aqui
MONGODB_URI=mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=finance_person
```

> `.env` está en `.gitignore` y no se sube al repositorio.

## 7. Scripts disponibles

| Comando | Acción |
|---|---|
| `npm.cmd run dev` | API + Frontend en modo desarrollo (recomendado en Windows) |
| `npm run dev:server` | Solo la API (nodemon, reinicio automático) |
| `npm run dev:web` | Solo Vite |
| `npm run build` | Compila el frontend a `dist/` |
| `npm start` | Servidor de producción |
| `npm run seed` | Siembra datos demo y admin de forma manual (idempotente) |
| `npm test` | Suite e2e de la API (89 checks) contra una base temporal — ver [PRUEBAS.md](PRUEBAS.md) |
| `npm run test:ui` | Verificación headless de la interfaz con **jsdom** (23 checks: cada dato visualizado vs API) — ver [PRUEBAS.md](PRUEBAS.md) |