# Usuarios, Roles y Accesos

## 1. Cuentas iniciales (seed)

Al primer arranque, la API crea automáticamente tres cuentas con datos de demostración:

| Rol | Correo | Contraseña | Dataset |
|---|---|---|---|
| **Administrador** | `admin@finance.person` | `Admin12345` | Completo (12 meses) |
| **Usuario demo** | `demo@finance.person` | `Demo12345` | Completo (12 meses) |
| **Usuario demo 2** | `valen@finance.person` | `Valen12345` | Completo (12 meses) |

> ⚠️ Cambia estas contraseñas en el panel **Perfil** antes de usarlo con datos reales.

### Dataset de demostración (usuario `demo`)

Incluye datos detallados para explorar todas las pantallas:

- **Cuentas (4):** Banco Principal (banco), Ahorro (ahorro), Efectivo (efectivo) y Tarjeta Crédito (crédito).
- **Categorías (14):** las 10 por defecto + Servicios, Suscripciones, Viajes y Bonos.
- **Movimientos (~130 en 12 meses):** nómina mensual (4200), ingresos freelance variables, ahorro programado, bonos trimestrales, y gastos recurrentes (renta, alimentación, transporte, servicios, educación, salud, ocio) más variables (viajes, compras extra).
- **Presupuestos:** 7 categorías con presupuesto en **cada mes** (Vivienda 850, Alimentación 580, Transporte 150, Ocio 200, Salud 80, Educación 200, Servicios 110), con progreso calculado en vivo.
- **Mes actual:** solo se generan movimientos hasta la fecha, para ver KPIs parciales realistas.

### Dataset de demostración (usuario `admin`)

- **Cuentas (3):** Principal (banco), Caja (efectivo) e Inversiones (ahorro).
- **Movimientos (12 meses):** sueldo mensual (4200), ingresos por consultoría, dividendos de inversiones y gastos del negocio (hosting, publicidad, software, oficina).
- **Presupuestos:** 3 categorías presupuestadas cada mes.

### Dataset de demostración (usuario `valen`)

- **Cuentas (2):** Banco (banco) y Vs (ahorro).
- **Movimientos (12 meses):** freelance mensual (3000–4500) y gastos fijos/variables.
- **Presupuestos:** 1 categoría cada mes. Su rol es `user` (no admin), para probar el aislamiento multiinquilino.

Las bases de datos ya existentes se **enriquecen de forma automática** al arrancar el servidor (si al usuario `demo` le falta la cuenta "Banco Principal", se agrega su dataset completo; el de `admin` se agrega si no tiene movimientos; el de `valen` es aditivo). Para regenerar desde cero: `npm run seed` (idempotente; ver [EJECUCION.md](EJECUCION.md)).

### Panel de administración en vivo

- El panel **Administración** (`#/admin`) muestra las estadísticas globales (6 tarjetas) y se **actualiza solo** ante cualquier cambio de datos (movimientos, cuentas, categorías, presupuestos) gracias al evento `fp:data-changed`.
- Permite registrar un **"Nuevo movimiento"** desde el propio panel (con las cuentas y categorías del admin) y las tarjetas se refrescan al instante. También hay un botón **"↻ Actualizar"** manual.

## 2. Modelo de control de acceso (RBAC)

Sistema de dos roles definido en la tabla `users.role`:

| Permiso | Usuario estándar (`user`) | Administrador (`admin`) |
|---|---|---|
| Ver y gestionar **sus** movimientos | ✅ | ✅ |
| Crear/editar **sus** categorías y cuentas | ✅ | ✅ |
| Ver su dashboard, presupuestos y reportes | ✅ | ✅ |
| Exportar PDF / Excel | ✅ | ✅ |
| Editar su perfil y contraseña | ✅ | ✅ |
| **Categorías del sistema** (compartidas) | Ver 👀 | Crear / editar / eliminar |
| **Todos** los usuarios y sus datos | ❌ | ✅ |
| Ver estadísticas globales de la plataforma | ❌ | ✅ |
| Eliminar usuarios | ❌ | ✅ |

Cómo se aplica:

- **`server/middleware/auth.middleware.js`** valida el JWT (`authenticate`) y expone `req.auth`.
- **`requireRole('admin')`** protege todo el grupo de rutas `/api/admin/*`.
- Las **políticas finas** se centralizan en la **capa de servicios** (p. ej. `category.service.canManage`): una categoría de sistema solo puede editarla un admin; una propia, solo su dueño.
- Cada operación crítica verifica rol y propiedad antes de tocar los datos.

## 3. Aislamiento de datos (SaaS multiinquilino)

Todas las tablas principales llevan `userId` (inquilino):

```
transactions.userId  accounts.userId  budgets.userId  categories.userId
```

Los **repositorios** filtran siempre por `userId` en cada consulta (`WHERE userId = @userId`), salvo las categorías globales del sistema (`isSystem = 1`) que son compartidas. Esto garantiza que cada usuario solo lee y escribe sus datos, incluso si las rutas son comunes.

Verificado por pruebas: un usuario A **no puede** modificar datos del usuario B ni acceder a `/api/admin/*` (403).

## 4. Registro de usuarios

`POST /api/auth/register` crea una cuenta nueva y además:

- Genera **categorías por defecto** (Salario, Alimentación, Vivienda, etc.).
- Crea una **cuenta "Efectivo"** como principal.
- Devuelve `{ user, token }` para iniciar sesión automáticamente.

La interfaz está en **`#/register`**.

## 5. Inicio de sesión

`POST /api/auth/login` → `{ user, token }`.

- El token JWT (HS256, expira en 12 h) se guarda en `localStorage` y se envía como `Authorization: Bearer <token>`.
- La sesión se restaura al recargar la página.

## 6. Recuperación de contraseña

Flujo demo (sin SMTP):

1. `POST /api/auth/forgot-password` con el correo → genera un token válido por 5 minutos.
2. La respuesta devuelve el **token** en crudo (en producción se enviaría por correo).
3. `#/reset/<token>` → `POST /api/auth/reset-password` con la nueva contraseña.

Validaciones de contraseña: mínimo 8 caracteres, al menos una letra y un número.

## 7. Reglas de validación de datos

| Campo | Regla |
|---|---|
| Correo | Formato válido, único |
| Contraseña | ≥ 8 caracteres, letras + números |
| Monto | Número > 0 (máx. 2 decimales) |
| Fecha | `AAAA-MM-DD` válida |
| Nombres | No vacíos |
| Presupuesto | Número ≥ 0 |
| Color | `#RRGGBB` |