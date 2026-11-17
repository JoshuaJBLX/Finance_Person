# Backend — API REST (Node.js + Express + MongoDB Atlas)

## 1. Arquitectura por capas

```
HTTP (rutas) → Controller → Service → Repository → MongoDB Atlas
                 │            │            │
               valida       negocio +    aísla datos
               entradas     autorización  por usuario
```

| Capa | Responsabilidad | Ubicación |
|---|---|---|
| **Routes** | Define endpoints y aplica middleware (`authenticate`, `requireRole`) | `server/routes/` |
| **Controller** | Capa HTTP delgada: lee `req`, llama services, responde | `server/controllers/` |
| **Service** | Reglas de negocio, validaciones y **autorización centralizada** | `server/services/` |
| **Repository** | Acceso a MongoDB; **filtra siempre por `userId`** (multiinquilino) | `server/repositories/` |

**Flujo típico** (crear un movimiento):

1. `POST /api/transactions` (route con `authenticate`)
2. `transactionController.create` → `transactionService.create(user, payload)`
3. El service valida tipo/monto/fecha y comprueba que la cuenta y categoría pertenezcan al usuario
4. `transactionRepository.create(...)` inserta con `userId = req.auth.sub`
5. Respuesta `201` con el registro

## 2. Principios aplicados

- **SOLID**: servicios con responsabilidad única; repositorios separados de la lógica.
- **Controller–Service–Repository**: capas desacopladas.
- **Autorización centralizada**: permisos y propiedad se verifican en el service, no en rutas.
- **Aislamiento por inquilino**: el repositorio recibe `userId` y lo aplica en todo `WHERE`.
- DRY (helpers reutilizados: `sumByType`, `listVisible`), KISS, YAGNI (sin funcionalidad especulativa).

## 3. Base de datos (MongoDB Atlas)

- Motor: MongoDB 8.0 (cluster **M0** gratuito). Driver oficial `mongodb` v6 (asíncrono).
- Conexión: `MONGODB_URI` en `.env`. Base: `finance_person` (o `MONGODB_DB`).
- `server/config/database.js` crea los índices y expone `connect()` / `getDb()` / `close()`.
- Colecciones: `users`, `categories`, `accounts`, `transactions`, `budgets`, `password_resets`.
- Las relaciones se resuelven con `$lookup` (agregaciones) y borrados en cascada explícitos en los repositorios.
- Todas las capas (repositorio → servicio → controlador) son **asíncronas** (`async/await`) porque el driver `mongodb` no es síncrono.

### Colecciones

**users**
| Campo | Descripción |
|---|---|
| `_id` | UUID v4 (PK; se expone como `id` en la API) |
| firstName / lastName | Nombre y apellido |
| email | Único |
| passwordHash | bcrypt (10 rondas) |
| role | `user` \| `admin` (RBAC) |
| createdAt / updatedAt | ISO 8601 |

**categories**
| Campo | Descripción |
|---|---|
| `_id` / name / type / color | Datos base (`income` \| `expense`) |
| userId | `null` + `isSystem: true` ⇒ categoría global del sistema |
| isSystem | booleano: `false` = propia, `true` = compartida (solo admin edita) |

**accounts**
- `_id`, userId, name (única por usuario), type (`cash|bank|savings|credit|other`), initialBalance, isDefault (booleano).

**transactions**
- `_id`, userId, accountId, categoryId, type (`income|expense`), amount (>0), description, date; `accountName`/`categoryName` se añaden con `$lookup`.
- Índices por `(userId, date)` y `(userId, type)`.

**budgets**
- `_id`, userId, categoryId, month (`AAAA-MM`), amount; índice único por `(userId, categoryId, month)`.

**password_resets**
- `_id` (token), userId, expiresAt, used — flujo de recuperación de contraseña (expira en 5 min).

> No hay FK nativos en MongoDB: las cascadas son explícitas en los repositorios (`userRepository.deleteUser`, `categoryRepository.remove`). Al borrar un usuario se borra **todo** su tenant.

## 4. Autenticación y sesión

- `POST /api/auth/login` valida credenciales (bcrypt) y firma un **JWT HS256** con `sub`, `email`, `role` y `name` (expiración 12 h).
- Middleware `authenticate` (express-jwt) resuelve y coloca `req.auth`.
- `requireRole('admin', …)` restringe rutas por rol.
- Errores JWT (`UnauthorizedError`) se traducen a `401`.

## 5. Referencia de endpoints

Todas las rutas bajo `/api`. Las marcadas con 🔒 requieren `Authorization: Bearer <token>`.

### Salud
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |

### Auth (público)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Crea usuario + categorías + cuenta por defecto |
| POST | `/auth/login` | Inicia sesión → `{ user, token }` |
| POST | `/auth/forgot-password` | Genera token de recuperación (demo devuelve token) |
| GET | `/auth/verify-reset?token=` | Valida vigencia del token |
| POST | `/auth/reset-password` | `{ token, password }` → nueva contraseña |
| GET | `/auth/me` 🔒 | Perfil del usuario actual |

### Usuarios 🔒
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/users/me` | Perfil propio |
| PUT | `/users/me` | Actualiza nombre, apellido y/o contraseña (verifica la actual) |

### Categorías 🔒
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/categories?type=` | Propias + del sistema, filtrable por tipo |
| POST | `/categories` | Crea categoría propia `{ name, type, color }` |
| PUT | `/categories/:id` | Renombra/cambia color (limitado por permisos) |
| DELETE | `/categories/:id` | Elimina (no permite borrar del sistema si no es admin) |

### Cuentas 🔒
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/accounts` | Cuentas con saldo calculado (movimientos + inicial) |
| POST | `/accounts` | Crea cuenta |
| PUT | `/accounts/:id` | Edita |
| PUT | `/accounts/:id/default` | Marca cuenta principal |
| DELETE | `/accounts/:id` | Elimina (rechaza si tiene movimientos) |

### Movimientos 🔒
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/transactions` | Lista paginada. Filtros: `accountId, categoryId, type, from, to, search, page, limit` |
| POST | `/transactions` | Crea `{ accountId, categoryId, type, amount, date, description }` |
| PUT | `/transactions/:id` | Edita parcialmente |
| DELETE | `/transactions/:id` | Elimina |

### Presupuestos 🔒
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/budgets?month=YYYY-MM` | Lista con gasto real y % de avance |
| GET | `/budgets/summary?month=` | Totales (asignado, gastado, categorías) |
| POST | `/budgets` | Crea o actualiza `{ categoryId, month, amount }` |
| DELETE | `/budgets/:id` | Elimina |

### Reportes 🔒
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/reports/summary?from&to` | Ingresos, gastos, balance y tasa de ahorro |
| GET | `/reports/by-category?type&from&to` | Totales por categoría |
| GET | `/reports/by-account?from&to` | Ingresos/gastos por cuenta |
| GET | `/reports/monthly?from&to` | Series mensuales (ingresos vs gastos) |
| GET | `/reports/full?from&to&month` | Bundle completo para exportar PDF/Excel |

### Administración 🔒 + rol `admin`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/stats` | Métricas globales de toda la plataforma |
| GET | `/admin/overview` | Resumen global (alias de stats) |
| GET | `/admin/users` | Lista usuarios (`search, page, limit`) |
| GET | `/admin/users/:id/transactions` | Movimientos de un usuario (con resumen) |
| DELETE | `/admin/users/:id` | Elimina usuario y su tenant (cascade) |
| GET / POST | `/admin/categories/system` | Listar / crear categorías del sistema |
| PUT / DELETE | `/admin/categories/system/:id` | Editar / eliminar categorías del sistema |

## 6. Manejo de errores

- Los services lanzan `AppError(status, mensaje)`.
- `middleware/error.middleware.js` los serializa como `{ error, details? }`.
- Códigos usados: `400` validación, `401` no autenticado, `403` sin rol, `404` no encontrado, `409` duplicado, `500` interno.
- Errores JWT → `401` automáticamente.

## 7. Factores de entorno

Las variables se leen desde **`.env`** en la raíz del proyecto (vía `dotenv`) o del entorno del sistema:

| Variable | Default | Uso |
|---|---|---|
| `PORT` | `4000` | Puerto del servidor |
| `JWT_SECRET` | valor de desarrollo | Firma de tokens (**cambiar en producción**) |
| `NODE_ENV` | — | `production` = logs combinados + sirve `dist/` |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Cadena de conexión a Atlas |
| `MONGODB_DB` | `finance_person` | Nombre de la base de datos |
| `MONGODB_TEST_DB` | `finance_person_test` | Base efímera usada por las pruebas |

> El archivo `.env` está en `.gitignore`; `.env.example` no es necesario: basta con copiar el bloque de la tabla. La clave `JWT_SECRET` se resuelve en `server/middleware/auth.middleware.js`.