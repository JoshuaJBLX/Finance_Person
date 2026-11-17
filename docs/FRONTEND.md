# Frontend — SPA con Vite

Frontend en **JavaScript ES2023** (módulos nativos), compilado con **Vite**. SPA con enrutamiento por **hash** y renderizado de vistas vanilla (sin frameworks).

## 1. Estructura

```
src/
├── main.js                # Punto de entrada: bootstrap + router (hash) + shell
├── api.js                 # Cliente fetch con token y errores tipados
├── store.js               # Sesión en localStorage (usuario + JWT)
├── styles/
│   └── main.css           # Design system completo (estética Hatton Labs)
├── utils/
│   ├── format.js          # money, fechas (Day.js locale es), %, iniciales
│   ├── charts.js          # Wrappers Chart.js + paleta + limpieza
│   └── ui.js              # Modales, toasts, confirmaciones, alertas
└── views/                 # Una vista por pantalla
    ├── AuthView.js        # login / registro / recuperar / reset
    ├── DashboardView.js   # KPIs + gráficos + presupuesto + cuentas
    ├── TransactionsView.js# historial con filtros y CRUD
    ├── AccountsView.js    # cuentas/medios de pago
    ├── CategoriesView.js
    ├── BudgetsView.js
    ├── ReportsView.js     # analítica + exportación PDF/Excel
    ├── AdminView.js       # panel admin (RBAC)
    └── ProfileView.js
```

## 2. Arranque y enrutamiento

`main.js` ejecuta `bootstrap()` al cargar:

1. Restaura el token de `localStorage`.
2. Lee el **hash** (`#/dashboard`, `#/transactions`, …).
3. Renderiza la pantalla correspondiente:
   - Sin sesión → pantallas de acceso (`#/login|register|forgot|reset`).
   - Con sesión → **shell** (sidebar + vista) y enruta a la vista.
   - `#/admin` solo si `role === 'admin'` (si no, redirige a dashboard).

Cada vista expone `mount(root, params)` y se encarga de su propio ciclo de vida (datos, eventos, gráficos). La navegación re-monta la vista y limpia gráficos anteriores (`destroyAll()`).

## 3. Cliente API y sesión

- `src/api.js`: envoltorio `fetch` que añade `Authorization: Bearer` y normaliza errores (`/api/...`). Cadena de query con `makeQuery()`.
- `src/store.js`: guarda/elimina la sesión en `localStorage` (`fp_session`).
- Flujo de login: `POST /auth/login` → se guarda `{ user, token }`→ redirige a `#/dashboard`.

## 4. Design system (estética Hatton Labs "About")

Paleta aplicada por variables CSS (`:root`):

| Color | Hex | Uso |
|---|---|---|
| Negro profundo | `#0A0A0A` | Fondo base |
| Blanco puro | `#F5F5F5` | Texto principal |
| Verde lima/neón | `#C7F13A` | Acento: CTAs, activos, gráficos |
| Gris oscuro | `#2B2B2B` | Bordes y superficies |
| Gris medio | `#7A7A7A` | Textos secundarios |
| Plateado claro | `#D9D9D9` | Líneas y metadatos |

Rasgos del estilo (heredados del *About* de Hatton Labs):

- **Tipografía display de gran tamaño**: `Space Grotesk` (títulos en mayúsculas, `text-transform`) + `Space Mono` para números y etiquetas técnicas.
- **Alto contraste B/N + neón**: fondos negros, textos blancos y destellos de verde lima; grano/ruido sutil superpuesto a toda la página.
- **Retícula asimétrica**: `display` con `text-balance`/clamp, grids desiguales (`grid--asym`), sellos y elementos superpuestos (círculos decorativos en tarjetas).
- **Marca**: el logotipo **Finance Person** (`FP_LOGO.png`) aparece en el login (póster), en el sidebar y como favicon.

## 5. Vistas y funcionalidad

| Vista | Contenido |
|---|---|
| **Auth** | Póster editorial con el logo + formularios (login/registro/recuperar/reset). Atajo "Probar cuenta demo". |
| **Dashboard** | Hero display, 4 KPIs (ingresos, gastos, balance neón, patrimonio), gráfico de línea 12 meses, dona de gastos por categoría, cumplimiento de presupuesto y resumen por cuentas. |
| **Movimientos** | Tabla con filtros (rango fechas, tipo, categoría, cuenta, búsqueda) y totales; alta/edición/borrado con modal. |
| **Cuentas** | Tarjetas con saldo calculado, marcado de principal, distribución por cuenta. |
| **Categorías** | Listas de ingresos/gastos con color; las del sistema se marcan y solo se editan como admin. |
| **Presupuestos** | Selector de mes, KPIs de cumplimiento y barras de progreso por categoría (rojo si supera el límite). |
| **Reportes** | KPIs del período + 4 gráficos y **exportación PDF** (jsPDF + autotable) y **Excel** (SheetJS). |
| **Admin** | Métricas globales, buscador de usuarios, detalle de movimientos por usuario, gestión de categorías del sistema, borrado de usuarios. |
| **Perfil** | Edición de datos personales y cambio de contraseña (verifica la actual). |

## 6. Gráficos (Chart.js)

`src/utils/charts.js` provee: `lineChart`, `doughnutChart`, `barChart` con estilos acordes al tema (grid `#1c1c1c`, tooltips oscuros, acentos neón) y una paleta fija.

```js
lineChart('lineChart', labels, income, expenses);     // evolución
doughnutChart('doughnutChart', labels, data, colors); // distribución
barChart('trendChart', labels, values, { second });   // comparativa
```

Los gráficos se registran por id y se destruyen al cambiar de vista (evita fugas de memoria).

## 7. Exportación de reportes

- **Excel**: `xlsx` (SheetJS). Graba `Resumen + Detalle de movimientos` en **`finance-person_YYYYMMDD_HHmm.xlsx`**.
- **PDF**: `jspdf` + `jspdf-autotable`. Cabecera de marca, tabla de resumen con acento lima y detalle de movimientos → **`.pdf`**.
- Datos tomados de `GET /api/reports/full?from=&to=` (ya aislados por usuario).

## 8. Interacción y feedback

- Confirmaciones destructivas: **SweetAlert2** (estilizado al tema).
- Notificaciones del sistema: **Toastify** (esquina superior derecha).
- Validaciones en vivo del servidor se muestran en el toast/alert correspondiente.

## 9. Estado actual

- La marca visible en la pantalla de acceso indica **MongoDB Atlas · Node.js · SaaS**.
- Verificación headless (`npm run test:ui`): **23/23** comprobaciones correctas contra la API real (datos del panel admin, KPIs del dashboard, movimientos y refresco en vivo).
- En `NODE_ENV=test`, `src/utils/charts.js` omite Chart.js porque jsdom no tiene canvas; el resto del render se verifica igual.