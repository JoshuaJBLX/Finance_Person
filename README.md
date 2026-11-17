# Finance Person — Dashboard de Finanzas Personales

Aplicación web **SaaS** para registrar, organizar, visualizar y analizar ingresos y gastos personales. Interfaz moderna, oscura y editorial inspirada en el *About* de **Hatton Labs** (negro profundo, verde lima neón y tipografía display).

## ✦ Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · CSS3 · JavaScript ES2023 · **Vite** |
| Gráficos | **Chart.js** |
| Fechas | **Day.js** |
| Alertas / Notificaciones | **SweetAlert2** · **Toastify** |
| Exportación | **SheetJS** (Excel) · **jsPDF** (PDF) |
| Backend | **Node.js** · **Express** |
| Base de datos | **MongoDB Atlas** (driver oficial `mongodb` v6) |
| Autenticación & RBAC | **JSON Web Tokens** (`jsonwebtoken` + `express-jwt`) |
| Validación | `validator.js` | 
| IDs | `uuid` |
| Pruebas UI (headless) | **jsdom** (DOM en Node para `npm run test:ui`) |

## ✦ Requisitos

- **Node.js 18+** (probado con v24 y v25) — descargar en https://nodejs.org
- **npm 8+** (incluido con Node.js)
- Navegador moderno (Chrome, Edge, Firefox)

> ⚠️ La app se conecta a **MongoDB Atlas**. Copia el bloque de variables de [docs/EJECUCION.md](docs/EJECUCION.md#6-variables-de-entorno-opcional) en un `.env` en la raíz (el archivo está en `.gitignore`). Sin `MONGODB_URI` se usa `mongodb://127.0.0.1:27017` como fallback local.

## ✦ Instalación

```bash
# 1. Verifica las versiones instaladas
node --version     # ≥ 18
npm --version      # ≥ 8

# 2. Instala todas las dependencias (backend + frontend + herramienta de pruebas UI)
npm install        # o `npm ci` para una instalación reproducible desde package-lock.json
```

## ✦ Inicio rápido (modo desarrollo)

```bash
npm run dev        # Windows/PowerShell: `npm.cmd run dev` (o el script .\dev.bat)
```

- **Frontend (Vite):** http://localhost:5173 (hot reload)
- **API REST:** http://localhost:4000/api

> **Windows/PowerShell**: si `npm` falla por la política de ejecución de scripts, usa `npm.cmd run dev` o el script incluido `.\dev.bat` (alternativa: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`). Detalles en [docs/EJECUCION.md](docs/EJECUCION.md#3-modo-desarrollo-recomendado).

En desarrollo la API corre en **4000** y Vite redirige `/api` hacia ella. La base de datos de Atlas se conecta y **siembra automáticamente** en el primer arranque.

## ✦ Inicio rápido (modo producción)

```bash
npm run build      # compila el frontend a dist/
npm start          # sirve dist/ + API en el puerto 4000 (un solo proceso)
```

Abrir **http://localhost:4000**.

## ✦ Cuentas iniciales (seed automático)

| Rol | Correo | Contraseña |
|---|---|---|
| **Administrador** | `admin@finance.person` | `Admin12345` |
| **Usuario demo** | `demo@finance.person` | `Demo12345` |
| **Usuario demo 2** | `valen@finance.person` | `Valen12345` |

El usuario `demo` incluye un dataset detallado (12 meses de movimientos, 4 cuentas y presupuestos mensuales). Más información en [docs/USUARIOS.md](docs/USUARIOS.md).

## ✦ Funcionalidades

- Registro de ingresos y gastos con validación.
- Administración de categorías (ingresos/gastos) y cuentas/medios de pago.
- Historial de movimientos con filtros por fechas, categorías, cuentas, tipo y búsqueda.
- Dashboard con indicadores (ingresos, gastos, balance, patrimonio, tasa de ahorro) y gráficos.
- Presupuesto mensual por categoría con barras de cumplimiento.
- Exportación de reportes a **PDF** y **Excel**.
- Gestión de usuarios: registro, login y recuperación de contraseña (flujo demo con token).
- **RBAC**: usuario estándar y administrador.
- **SaaS multiinquilino**: aislamiento de datos por `userId` en la capa de repositorio.

## ✦ Documentación

| Tema | Archivo |
|---|---|
| Instalación y ejecución | [docs/EJECUCION.md](docs/EJECUCION.md) |
| Usuarios, roles y accesos | [docs/USUARIOS.md](docs/USUARIOS.md) |
| Arquitectura del backend y API | [docs/BACKEND.md](docs/BACKEND.md) |
| Frontend, vistas y diseño | [docs/FRONTEND.md](docs/FRONTEND.md) |
| Pruebas de la API (89 checks) | [docs/PRUEBAS.md](docs/PRUEBAS.md) |

## ✦ Pruebas

```bash
npm test          # Suite e2e de la API (89 checks)
npm run test:ui   # Verificación headless de la interfaz (23 checks, necesita jsdom)
```

Suite end-to-end (89 verificaciones) que levanta la API contra una base temporal y cubre autenticación, RBAC, aislamiento multiinquilino y todos los CRUD. `test:ui` monta las vistas reales del frontend en **jsdom** contra la API y compara cada dato visualizado. Detalles en [docs/PRUEBAS.md](docs/PRUEBAS.md).

## ✦ Estructura de carpetas

```
Finance_Person/
├── FP_LOGO.png              # Logo marca "Finance Person"
├── index.html               # Entrada de la SPA
├── package.json
├── vite.config.js
├── dev.bat                  # Inicio rápido para Windows (evita la política de scripts)
├── public/
│   └── FP_LOGO.png
├── scripts/
│   └── test-api.mjs         # Suite e2e de la API (npm test)
├── server/                  # API REST (Express)
│   ├── app.js               # Bootstrap del servidor + servir dist
│   ├── config/              # database.js + seed.js
│   ├── controllers/         # Capa HTTP (delgada)
│   ├── services/            # Lógica de negocio + autorización
│   ├── repositories/        # Acceso a MongoDB + aislamiento por usuario
│   ├── routes/              # Definición de rutas (con auth/RBAC)
│   ├── middleware/          # auth (JWT), errores
│   └── utils/               # helpers, manejo de errores
└── src/                     # Frontend (Vite)
    ├── main.js              # Bootstrap del SPA + router por hash
    ├── api.js               # Cliente HTTP con token
    ├── store.js             # Sesión (localStorage)
    ├── styles/main.css      # Design system (estética Hatton)
    ├── utils/               # format.js, charts.js, ui.js
    └── views/               # Una vista por pantalla
```