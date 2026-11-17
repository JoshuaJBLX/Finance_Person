# Usuarios, Roles y Accesos

> Estado actual: la app usa **MongoDB Atlas** (base `finance_person`). Los datos demo se siembran automáticamente al arrancar o con `npm run seed`.

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

- **Cuentas (4):** Banco Principal (`bank`, saldo inicial 5000, principal), Ahorro (`savings`, 12000), Tarjeta Crédito (`credit`, 0) y Efectivo (`cash`, 0).
- **Categorías (14):** las 10 por defecto (Salario, Freelance, Inversiones, Vivienda, Alimentación, Transporte, Ocio, Salud, Educación, Otros gastos) + Servicios, Suscripciones, Viajes y Bonos.
- **Movimientos (~130 en 12 meses):** nómina mensual (3800–4650), freelance variable, dividendos/ahorro, bonos esporádicos; gastos recurrentes (suscripciones, renta, transporte, luz e internet, supermercado, curso online, farmacia, cine) y variables (viajes, compras extra).
- **Presupuestos:** 7 categorías en **cada mes** (Vivienda 850, Alimentación 580, Transporte 150, Ocio 200, Salud 80, Educación 200, Servicios 110), con progreso calculado en vivo.
- **Mes actual:** solo se generan movimientos hasta la fecha, para ver KPIs parciales realistas.

### Dataset de demostración (usuario `admin`)

- **Cuentas (3):** Principal (`bank`, 1000, principal), Caja (`cash`, 200) e Inversiones (`savings`, 8000).
- **Movimientos (12 meses):** nómina mensual (3200–4200) y gastos de "Gastos generales", "Caja / efectivo", "Servicios", "Alimentación y hogar", "Viajes" y "Ocio".
- **Presupuestos:** 3 categorías cada mes (Gastos 1500, Servicios 320, Viajes 260).

### Dataset de demostración (usuario `valen`)

- **Cuentas (2):** Banco (`bank`, 2500, principal) y Efectivo (`cash`, 0).
- **Movimientos (12 meses):** nómina fija de 2100, renta 700, transporte 90, supermercado 380 y ocio 100.
- **Presupuestos:** Alimentación (420) cada mes. Su rol es `user` (no admin), para probar el aislamiento multiinquilino.

Las bases de datos ya existentes en Atlas se **enriquecen de forma automática** al arrancar el servidor (si al usuario `demo` le falta la cuenta "Banco Principal", se agrega su dataset completo; el de `admin` se agrega si no tiene movimientos; el de `valen` es aditivo). Para regenerar desde cero: `npm run seed` (idempotente; ver [EJECUCION.md](EJECUCION.md)).

### Panel de administración en vivo

- El panel **Administración** (`#/admin`) muestra las estadísticas globales (6 tarjetas) y se **actualiza solo** ante cualquier cambio de datos (movimientos, cuentas, categorías, presupuestos) gracias al evento `fp:data-changed`.
- Permite registrar un **"Nuevo movimiento"** desde el propio panel (con las cuentas y categorías del admin) y las tarjetas se refrescan al instante. También hay un botón **"↻ Actualizar"** manual.

## 2. Modelo de control de acceso (RBAC)

Sistema de dos roles definido en el campo `role` de la colección `users`:

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

- **`server/middleware/auth.middleware.js`** valida el JWT con express-jwt (`authenticate`) y expone `req.auth`.
- **`requireRole('admin')`** protege todo el grupo de rutas `/api/admin/*`.
- Las **políticas finas** se centralizan en la **capa de servicios** (p. ej. `categoryService.canManage`): una categoría de sistema (`isSystem: true`) solo puede editarla un admin; una propia, solo su dueño.
- Cada operación crítica verifica rol y propiedad antes de tocar los datos en MongoDB.

## 3. Aislamiento de datos (SaaS multiinquilino)

Todas las colecciones principales llevan `userId` (UUID del inquilino):

```
transactions.userId  accounts.userId  budgets.userId  categories.userId
```

Los **repositorios** aplican siempre un filtro `{ userId }` en sus consultas y agregaciones (`$match: { userId, ... }`), salvo las categorías globales del sistema (`isSystem: true`, `userId: null`) que son compartidas. Esto garantiza que cada usuario solo lee y escribe sus datos, incluso si las rutas son comunes.

Verificado por pruebas: un usuario A **no puede** modificar datos del usuario B ni acceder a `/api/admin/*` (403). Ver [docs/PRUEBAS.md](PRUEBAS.md).

## 4. Registro de usuarios

`POST /api/auth/register` crea una cuenta nueva y además:

- Genera **categorías por defecto** (Salario, Alimentación, Vivienda, etc.).
- Crea una **cuenta "Efectivo"** como principal.
- Devuelve `{ user, token }` para iniciar sesión automáticamente.

La interfaz está en **`#/register`**.

## 5. Inicio de sesión

`POST /api/auth/login` → `{ user, token }`.

- El token JWT (HS256, expira en 12 h, payload `{ sub, email, role, name }`) se guarda en `localStorage` y se envía como `Authorization: Bearer <token>`.
- La sesión se restaura al recargar la página.

## 6. Recuperación de contraseña

Flujo demo (sin SMTP):

1. `POST /api/auth/forgot-password` con el correo → genera un token válido por 5 minutos, almacenado en la colección `password_resets`.
2. La respuesta devuelve el **token** en crudo (`devOnly: true`; en producción se enviaría por correo).
3. `GET /api/auth/verify-reset?token=` valida el token.
4. `#/reset/<token>` → `POST /api/auth/reset-password` con la nueva contraseña.

Validaciones de contraseña: mínimo 8 caracteres, al menos una letra y un número.

## 7. Reglas de validación de datos

| Campo | Regla |
|---|---|
| Correo | Formato válido, único (índice en `users.email`) |
| Contraseña | ≥ 8 caracteres, letras + números (bcryptjs, 10 rondas) |
| Monto | Número > 0, redondeado a 2 decimales |
| Fecha | `AAAA-MM-DD` válida |
| Nombres | No vacíos |
| Presupuesto | Número ≥ 0 |
| Color | `#RRGGBB` |
| Mes (presupuesto) | `AAAA-MM` válido |
