# Pruebas Automatizadas del Proyecto

Suite de pruebas **end-to-end** sobre la API real (`scripts/test-api.mjs`) y **verificación de la interfaz** (`scripts/verify-ui.mjs`). Levantan el servidor contra la **base `finance_person_test`** de Atlas (`NODE_ENV=test`), ejecutan verificaciones sobre todas las funcionalidades y limpian los documentos al arrancar. La base real (`finance_person`) no se toca.

## Ejecutar

```bash
npm test        # Suite e2e de la API (89 checks)
npm run test:ui # Verificación headless de la interfaz (23 checks)
```

Código de salida: `0` = todo correcto · `1` = hay fallos.

Última ejecución sobre Atlas: **89/89** checks de API y **23/23** de UI, todos correctos.

> La suite UI usa **jsdom** (DOM headless en Node). Está declarado en `devDependencies` e `npm install` lo instala junto con el resto; si no lo tienes: `npm install --save-dev jsdom`.

## Cobertura de dependencias de prueba

| Paquete | Uso |
|---|---|
| `jsdom` | Entorno DOM headless para montar las vistas del frontend (`verify-ui.mjs`) |
| `dayjs` | Cálculo del mes/fechas en las verificaciones del dashboard |

> Node 18+: las suites requieren `fetch` global (disponible desde Node 18) y `import()` dinámico (ESM).

## Cobertura (10 secciones · 89 checks)

### 1. Autenticación y registro
- Registro de usuario nuevo (201 + token), email duplicado (409), contraseña débil (400), email inválido (400).
- Login correcto / contraseña incorrecta (401), `GET /auth/me`, y acceso sin token (401).

### 2. Recuperación de contraseña (flujo demo)
- `forgot-password` con y sin cuenta, `verify-reset`, `reset-password`, login con la **nueva** clave (200) y rechazo de la **anterior** (401).

### 3. Perfil de usuario
- Actualización de nombre/apellido y persistencia, nombre vacío (400), cambio de contraseña: actual incorrecta (400), sin actual (400) y flujo correcto.

### 4. Categorías (CRUD + sistema)
- Listado con bootstrap (≥10), creación, duplicado (409, sin distinción de mayúsculas), tipo/color inválidos (400), renombrado.
- **Categorías del sistema**: el admin crea/renombra; son visibles para todos; un usuario normal recibe **403** al editarlas o borrarlas.

### 5. Cuentas (CRUD + por defecto)
- Creación con saldo inicial, nombre duplicado (409), tipo/saldo inválidos (400), marcar como predeterminada (solo una), borrado de cuenta **con** movimientos (400) y **sin** movimientos (200).

### 6. Movimientos (CRUD, validación y filtros)
- Creación de ingreso/egreso, validaciones (monto negativo, fecha, tipo → 400).
- **Aislamiento**: usar cuenta o categoría de otro usuario → 400.
- Balance por cuenta tras un ingreso (100 + 1000 = 1100).
- Filtros: `type`, `search` (búsqueda "Nómina" = 12 salarios), rango `from`/`to`, `categoryId`.
- Actualización y borrado; el listado se refleja correctamente.

### 7. Presupuestos
- Mes actual con 7 presupuestos generados (dataset demo) y progreso/restante numérico.
- Resumen del mes (total = suma, count = 7), mes inválido (400), **upsert idempotente** (misma `id` al reescribir), categoría ajena (400), borrado.

### 8. Reportes
- `summary`: `income − expenses = balance` y `count` = total de movimientos.
- `by-category` (ingresos y egresos), tipo inválido (400), `by-account`, `monthly` (12 meses ordenados), `full` (bundle consistente), rango `from > to` (400).

### 9. Administración (RBAC)
- Usuario normal → **403** en `/admin/*`.
- Admin: lista de usuarios, estadísticas globales, movimientos por usuario (demo ≥ 100, valen ≥ 15), `overview`, eliminación de usuarios y liberación del email.

### 10. Aislamiento multiinquilino
- Las cuentas de cada usuario son **disjuntas**.
- Actualizar/eliminar datos de otro usuario → 404; editar categoría ajena → 403.
- El admin ve el total global de todos los tenants.

## Verificación de la interfaz (headless · 23 checks)

`npm run test:ui` ejecuta `scripts/verify-ui.mjs`: monta las **vistas del frontend real** (módulos de `src/`) en jsdom contra la API en vivo y comprueba que **cada dato que se visualiza** coincide con lo que devuelve la API:

1. **Panel de administración** — las 6 tarjetas de estadísticas (usuarios, movimientos, ingresos, gastos, cuentas, categorías) contra `/api/admin/stats`, y la tabla de usuarios contra `/api/admin/users`.
2. **Dashboard (demo)** — KPIs de ingresos/gastos/balance del mes y patrimonio total contra `/api/reports/summary` y `/api/accounts`; tasa de ahorro; chip y listado del presupuesto (`% utilizado`, filas por categoría); una fila por cuenta con su saldo exacto.
3. **Movimientos (demo)** — contador y número de filas de la tabla contra `/api/transactions`, y formato de montos con signo.
4. **Actualización en vivo** — tras crear un movimiento desde el panel admin, las tarjetas se **refrescan solas** (evento `fp:data-changed`) y el nuevo total coincide con la API.

Detalle técnico: en jsdom no hay canvas, así que `src/utils/charts.js` detecta el entorno headless (`NODE_ENV=test`) y no inicializa Chart.js, permitiendo que el resto del render (KPIs, presupuesto, cuentas) se complete y verifique. El flujo real en el navegador no cambia.

## Incidencias detectadas y corregidas durante el desarrollo

1. **`categoryRepository.update` lanzaba 500** al actualizar una categoría solo con `name` (bind de `undefined` en `color`). Se filtran ahora los campos `undefined`.
2. **El admin no podía renombrar ni eliminar categorías del sistema** (404): el chequeo usaba `isSystem !== 1` contra un valor booleano `true`. Corregido a `!cat.isSystem`.
3. **Migración a MongoDB**: los repositorios pasaron de síncronos a `async/await` (driver nativo), se reemplazaron los JOIN por `$lookup`, las agregaciones por pipelines y las FK por cascadas explícitas. La API HTTP quedó idéntica.
4. **`collation` en agregaciones**: el driver no expone `.collation()` en un `AggregationCursor`; se pasa como opción de `aggregate()`.
5. **Seed lento**: se cachearon las fechas existentes y se agruparon las inserciones en paralelo para que el arranque no tardara minutos contra Atlas.

## Base de pruebas

La suite fuerza `NODE_ENV=test`, por lo que `server/config/database.js` usa
`MONGODB_TEST_DB` (por defecto `finance_person_test`) y limpia sus documentos al arrancar:

```
MONGODB_TEST_DB=finance_person_test   # base efímera; se puede cambiar por entorno
```

El usuario de BD de la app tiene permisos `readWrite` sobre `finance_person` y
`finance_person_test`, así que las pruebas nunca afectan los datos de producción.