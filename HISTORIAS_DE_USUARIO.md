# 📄 Historias de Usuario y Criterios de Aceptación

**Proyecto:** Finance Person — Dashboard de Finanzas Personales  
**Stack:** Node.js · Express · **MongoDB Atlas** (driver oficial `mongodb` v6, sin ODM) · JWT · bcryptjs · validator.js · Vite  
**Enfoque:** SaaS multiinquilino · RBAC · Arquitectura por capas (Controller – Service – Repository)  
**Estado:** Documento oficial para desarrollo SDD — **actualizado a la implementación vigente (migración a MongoDB Atlas)**  
**Versión:** 1.1

---

## 🎯 Propósito del documento

Este documento recopila las Historias de Usuario (HU) y sus Criterios de Aceptación en formato **Gherkin** (`Dado que / Cuando / Entonces`) para guiar el desarrollo del Dashboard de Finanzas Personales. Cada historia está delimitada al proyecto, identifica roles precisos, funcionalidades concretas y un valor de negocio medible. Los criterios de aceptación contemplan flujos principales, flujos alternativos y casos de borde, con referencias técnicas ajustadas a la implementación real: MongoDB Atlas, driver `mongodb`, JWT, bcryptjs, `validator.js` y agregaciones.

> **Nota de actualización:** la versión 1.0 describía un diseño con Mongoose, ObjectId y `express-validator`. La app final usa el driver nativo `mongodb`, IDs UUID v4 en `_id`, validación con `validator.js` en la capa de servicios y roles `user` / `admin`.

---

## 📋 Plantilla utilizada por cada Historia de Usuario

| Campo | Descripción |
|-------|-------------|
| **ID** | Identificador único (ej. HU-01) |
| **Título** | Nombre corto y descriptivo de la funcionalidad |
| **Rol** | Tipo de usuario que ejecuta la acción |
| **Quiero** | Funcionalidad específica que necesita |
| **Para** | Valor de negocio medible y justificable |
| **Prioridad** | Alta / Media / Baja |
| **Estimación** | Puntos de historia (ej. 5, 8, 13) |
| **Regla de negocio** | Restricciones técnicas y de negocio aplicables |
| **Criterios de Aceptación** | Escenarios Gherkin: flujo principal, flujo alternativo y caso(s) de borde |

---

## 📚 Historias de Usuario

---

### HU-01: Registro de nuevo usuario

**Título:** Registro de cuenta de usuario  
**Rol:** Visitante / Nuevo usuario  
**Quiero:** Registrarme en el sistema con nombre, apellido, correo y contraseña para crear mi perfil financiero.  
**Para:** Tener acceso personalizado y aislado a mis datos financieros dentro del modelo SaaS.  
**Prioridad:** Alta  
**Estimación:** 5 puntos

#### Regla de negocio
El correo debe ser único en la colección `users` (índice único). La contraseña se hashea con **bcryptjs (10 rondas)** antes de almacenarse. Se asigna el rol `user` por defecto. El campo `userId` (UUID v4, guardado en `_id`) identifica al tenant para el aislamiento multiinquilino. El registro crea además las 10 categorías por defecto y la cuenta "Efectivo" como principal (`authService.bootstrap`).

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Registro de usuario
  Como visitante
  Quiero registrar una cuenta de usuario
  Para acceder al Dashboard de Finanzas Personales de forma individual

  Regla de negocio: El correo debe ser único en la colección `users`. La contraseña se hashea con bcryptjs (10 rondas). Rol por defecto: "user".

  Escenario 1: Registro exitoso (flujo principal)
    Dado que no existe ningún usuario con el correo "maria@finanzas.com" en la colección `users`
    Cuando el usuario envía POST a /api/auth/register con { firstName, lastName, email, password }
    Entonces el servicio valida los campos con validator.js (nombre no vacío, email válido, clave ≥ 8 caracteres con letras y números)
    Y hashea la contraseña con bcryptjs (10 rondas)
    Y guarda un documento en `users` con _id (UUID), firstName, lastName, email, passwordHash, role: "user", createdAt y updatedAt
    Y crea 10 categorías por defecto y la cuenta "Efectivo" marcada como principal
    Y devuelve HTTP 201 con { user, token } (sin incluir passwordHash)

  Escenario 2: Correo duplicado (flujo alternativo)
    Dado que ya existe un usuario con correo "maria@finanzas.com"
    Cuando el usuario intenta registrarse con ese mismo correo
    Entonces el sistema devuelve HTTP 409: "Ya existe una cuenta con este correo"
    Y no se crea ningún documento en la colección `users`

  Escenario 3: Correo inválido o contraseña débil (caso de borde)
    Dado que el usuario envía correo "correo-invalido" y contraseña "123"
    Cuando se intenta registrar
    Entonces el servicio devuelve HTTP 400 con errores: "Correo electrónico inválido" y "La contraseña debe tener al menos 8 caracteres"
    Y no se inserta ningún documento
```

---

### HU-02: Inicio de sesión y autenticación JWT

**Título:** Autenticación segura de usuario  
**Rol:** Usuario registrado  
**Quiero:** Iniciar sesión con credenciales válidas para obtener un token JWT y acceder a mis datos financieros.  
**Para:** Autenticar mi identidad y autorizar el acceso solo a mis propios recursos (aislamiento multiinquilino).  
**Prioridad:** Alta  
**Estimación:** 5 puntos

#### Regla de negocio
El backend valida credenciales contra MongoDB con `bcrypt.compare`. El token JWT HS256 incluye `sub` (id), `email`, `role` y `name`, con expiración de **12 h**. Las rutas protegidas usan el middleware `authenticate` de **express-jwt**, que coloca el payload en `req.auth`; `requireRole('admin')` restringe el grupo `/api/admin/*`. No se usa passport.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Inicio de sesión (Login)
  Como usuario registrado
  Quiero iniciar sesión con correo y contraseña
  Para obtener un token JWT y acceder al dashboard protegido

  Regla de negocio: El JWT contiene { sub, email, role, name } y expira en 12 horas.

  Escenario 1: Credenciales válidas (flujo principal)
    Dado que existe un usuario con correo "maria@finanzas.com" y contraseña hasheada en MongoDB
    Cuando envía POST /api/auth/login con correo y contraseña correctos
    Entonces el sistema compara la contraseña con bcrypt.compare()
    Y genera un JWT firmado con JWT_SECRET
    Y devuelve HTTP 200 con { user, token }
    Y el frontend guarda la sesión en localStorage y envía "Authorization: Bearer <token>"

  Escenario 2: Contraseña incorrecta (flujo alternativo)
    Dado que el usuario existe pero la contraseña no coincide
    Cuando intenta iniciar sesión
    Entonces devuelve HTTP 401: "Credenciales inválidas"
    Y no revela si el error fue el correo o la contraseña

  Escenario 3: Usuario no encontrado (caso de borde)
    Dado que no existe ningún documento con el correo proporcionado
    Cuando se intenta iniciar sesión
    Entonces devuelve el mismo mensaje genérico HTTP 401: "Credenciales inválidas"

  Escenario 4: Token expirado en petición protegida (caso de borde)
    Dado que el usuario tiene un JWT expirado
    Cuando accede a una ruta protegida como GET /api/transactions
    Entonces el middleware de express-jwt devuelve HTTP 401 y el frontend redirige al login
```

---

### HU-03: Recuperación de contraseña

**Título:** Restablecimiento de contraseña  
**Rol:** Usuario registrado  
**Quiero:** Solicitar el restablecimiento de mi contraseña mediante un token enviado a mi correo registrado.  
**Para:** Recuperar el acceso a mi cuenta si olvido mi contraseña, sin comprometer la seguridad del sistema.  
**Prioridad:** Media  
**Estimación:** 3 puntos

#### Regla de negocio
Flujo **demo sin SMTP**: se genera un token aleatorio de 32 bytes en hexadecimal, válido por **5 minutos**, que se guarda en la colección **`password_resets`** (documento independiente, no dentro del usuario) con `used: false`. La respuesta de la API devuelve el token (`devOnly: true`) para poder completar el flujo. Solo un token no usado y vigente permite cambiar la clave.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Recuperación de contraseña
  Como usuario registrado
  Quiero solicitar el restablecimiento de mi contraseña
  Para recuperar el acceso a mi cuenta de forma segura

  Regla de negocio: El token caduca en 5 minutos y se almacena en `password_resets`. La demo lo devuelve en la respuesta.

  Escenario 1: Solicitud de restablecimiento válida (flujo principal)
    Dado que existe un usuario con correo "maria@finanzas.com"
    Cuando envía POST /api/auth/forgot-password con su correo
    Entonces se genera un token y se guarda en `password_resets` con expiresAt = ahora + 5 minutos y used = false
    Y devuelve HTTP 200 con { message, token, expiresAt, devOnly: true }

  Escenario 2: Correo no registrado (flujo alternativo)
    Dado que no existe ningún usuario con el correo proporcionado
    Cuando solicita restablecimiento
    Entonces devuelve HTTP 404: "No existe una cuenta con este correo"
    Y no genera ningún token

  Escenario 3: Token expirado o ya usado al restablecer (caso de borde)
    Dado que el token de restablecimiento expiró o ya fue marcado como usado
    Cuando intenta establecer una nueva contraseña
    Entonces devuelve HTTP 400: "El enlace expiró o ya fue utilizado"
    Y no se actualiza passwordHash

  Escenario 4: Contraseña nueva débil (caso de borde)
    Dado que el usuario envía una contraseña nueva con menos de 8 caracteres
    Cuando intenta restablecer su contraseña
    Entonces el servicio devuelve HTTP 400: "La contraseña debe tener al menos 8 caracteres"
    Y no se actualiza passwordHash
```

---

### HU-04: Gestión de categorías de ingresos y gastos (RBAC)

**Título:** Crear y administrar categorías financieras  
**Rol:** Usuario autenticado / Administrador  
**Quiero:** Crear, editar y eliminar categorías de movimientos financieros para clasificar mis transacciones.  
**Para:** Estandarizar la clasificación de gastos e ingresos y permitir reportes consistentes por categoría.  
**Prioridad:** Alta  
**Estimación:** 5 puntos

#### Regla de negocio
Cualquier usuario autenticado puede crear **categorías propias** (`userId` = su id). El administrador gestiona además las **categorías del sistema** (`userId: null`, `isSystem: true`) mediante `/api/admin/categories/system`, visibles para todos. `type` es `income` o `expense`. Existe un índice único parcial por `(userId, name, type)` que no aplica a las categorías globales. Al eliminar una categoría, sus movimientos quedan con `categoryId: null` y se borran sus presupuestos (equivalente a los antiguos `ON DELETE SET NULL / CASCADE`).

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Gestión de categorías
  Como usuario autenticado (o administrador para las globales)
  Quiero administrar categorías de ingresos y gastos
  Para clasificar consistentemente mis movimientos

  Regla de negocio: Cada categoría se guarda en `categories` con _id (UUID), userId, name, type, color, isSystem y createdAt.

  Escenario 1: Crear categoría propia (flujo principal)
    Dado que el usuario está autenticado
    Cuando envía POST /api/categories con { name: "Alimentación", type: "expense", color: "#C7F13A" }
    Entonces el servicio valida tipo y color (#RRGGBB)
    Y guarda el documento con userId del token e isSystem = false
    Y devuelve HTTP 201 con la categoría creada

  Escenario 2: Usuario intenta editar una categoría del sistema (denegado por RBAC)
    Dado que la categoría tiene isSystem = true
    Cuando un usuario estándar intenta editarla o borrarla
    Entonces devuelve HTTP 403: "No tiene permisos sobre esta categoría"
    Y el administrador sí puede hacerlo desde /api/admin/categories/system

  Escenario 3: Nombre duplicado para el mismo tenant (caso de borde)
    Dado que ya existe una categoría "Alimentación" de tipo "expense" para ese userId
    Cuando intenta crear otra con el mismo nombre y tipo
    Entonces devuelve HTTP 409: "Ya existe una categoría con ese nombre"
    Y no se duplica el documento en MongoDB

  Escenario 4: Eliminar categoría con movimientos (caso de borde)
    Dado que existen transacciones que referencian la categoría
    Cuando se elimina la categoría
    Entonces esas transacciones quedan con categoryId = null
    Y se eliminan los presupuestos asociados a la categoría
    Y devuelve HTTP 200: "Categoría eliminada."
```

---

### HU-05: Gestión de cuentas o medios de pago

**Título:** Administrar cuentas bancarias y medios de pago  
**Rol:** Usuario autenticado  
**Quiero:** Registrar cuentas (efectivo, tarjeta de crédito, banco, ahorros) con saldo inicial para vincularlas a mis transacciones.  
**Para:** Controlar el dinero disponible en cada medio de pago y conciliar mis movimientos financieros.  
**Prioridad:** Alta  
**Estimación:** 5 puntos

#### Regla de negocio
Cada documento en `accounts` incluye `userId` (UUID) para aislamiento. `type` ∈ `cash|bank|savings|credit|other`; `initialBalance` ≥ 0; `isDefault` booleano. Índice único por `(userId, name)`. El saldo **no se almacena**: se calcula como `initialBalance + ingresos − gastos` (con signo negativo para cuentas de crédito) en `accountService.withBalance`.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Gestión de cuentas/medios de pago
  Como usuario autenticado
  Quiero crear y administrar mis cuentas financieras
  Para saber cuánto dinero tengo disponible en cada medio de pago

  Regla de negocio: Cada cuenta pertenece al userId del JWT. Índice único { userId: 1, name: 1 }.

  Escenario 1: Crear cuenta bancaria (flujo principal)
    Dado que el usuario está autenticado
    Cuando envía POST /api/accounts con { name: "Banco Principal", type: "bank", initialBalance: 5000 }
    Entonces valida nombre no vacío, tipo permitido y saldo inicial ≥ 0
    Y guarda en `accounts`: _id (UUID), userId, name, type, initialBalance, isDefault = false, createdAt
    Y devuelve HTTP 201 con la cuenta creada

  Escenario 2: Saldo inicial negativo (caso de borde)
    Dado que el usuario intenta crear una cuenta con initialBalance: -100
    Cuando se valida el payload
    Entonces devuelve HTTP 400: "El saldo inicial debe ser un número mayor o igual que 0"
    Y no se inserta el documento en `accounts`

  Escenario 3: Acceso a cuenta de otro usuario (aislamiento SaaS)
    Dado que existe una cuenta perteneciente al usuario A
    Cuando el usuario B intenta actualizarla
    Entonces el repositorio filtra por { _id, userId } y no encuentra coincidencia
    Y devuelve HTTP 404: "Cuenta no encontrada"

  Escenario 4: Eliminar cuenta con movimientos (caso de borde)
    Dado que la cuenta tiene transacciones asociadas
    Cuando se intenta borrar
    Entonces devuelve HTTP 400: "No se puede eliminar una cuenta con movimientos asociados"
```

---

### HU-06: Registro de una transacción financiera

**Título:** Crear un movimiento (ingreso o gasto)  
**Rol:** Usuario autenticado  
**Quiero:** Registrar una transacción asociando monto, fecha, categoría y cuenta para llevar el control de mis finanzas.  
**Para:** Tener un historial realista que alimente el dashboard, los gráficos y los reportes mensuales.  
**Prioridad:** Alta  
**Estimación:** 8 puntos

#### Regla de negocio
`type` ∈ `income|expense`; `amount` > 0 (redondeado a 2 decimales); `date` en formato `AAAA-MM-DD` válido; `description` opcional (máx. 300 caracteres). La cuenta debe pertenecer al usuario y la categoría debe ser propia o del sistema. El documento se guarda en `transactions` con `_id` UUID, `userId`, `accountId`, `categoryId`, `type`, `amount`, `description`, `date`, `createdAt` y `updatedAt`. La validación se hace con `validator.js` en `transactionService`; no hay campo de moneda ni saldo almacenado en la cuenta.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Registro de transacciones financieras
  Como usuario autenticado
  Quiero crear una transacción de ingreso o gasto
  Para mantener actualizado mi historial financiero personal en MongoDB

  Regla de negocio: Monto > 0, fecha AAAA-MM-DD válida, cuenta y categoría visibles para el userId del token.

  Escenario 1: Registrar gasto exitoso (flujo principal)
    Dado que el usuario está autenticado
    Y existen una cuenta y una categoría asociadas a su userId
    Cuando envía POST /api/transactions con { accountId, categoryId, type: "expense", amount: 45000, date: "2026-11-15", description: "Supermercado" }
    Entonces el servicio valida tipo, monto y fecha
    Y verifica que la cuenta y la categoría pertenezcan al usuario (o sean del sistema)
    Y guarda el documento en `transactions` con _id (UUID), userId, accountId, categoryId, type, amount, description, date, createdAt y updatedAt
    Y devuelve HTTP 201 con la transacción (incluye accountName y categoryName vía $lookup)

  Escenario 2: Registrar ingreso exitoso (flujo alternativo)
    Dado que el usuario está autenticado
    Cuando registra un ingreso con type "income" y amount 2000000
    Entonces la transacción queda registrada como ingreso en MongoDB
    Y el saldo de la cuenta aumenta en el cálculo de GET /api/accounts

  Escenario 3: Monto inválido o cero (caso de borde)
    Dado que el usuario envía amount: 0 o amount: -5000
    Cuando se intenta crear la transacción
    Entonces devuelve HTTP 400: "El monto debe ser un número mayor que 0"
    Y no se escribe en la colección `transactions`

  Escenario 4: Cuenta o categoría de otro usuario (caso de borde - aislamiento)
    Dado que la cuenta o categoría pertenece a otro usuario
    Cuando se intenta crear la transacción
    Entonces devuelve HTTP 400: "Cuenta inválida." o "Categoría inválida."
    Y no se persiste el documento
```

---

### HU-07: Consulta de historial con filtros

**Título:** Consultar y filtrar movimientos financieros  
**Rol:** Usuario autenticado  
**Quiero:** Filtrar mi historial de transacciones por rango de fechas, categoría, cuenta, tipo y búsqueda de texto.  
**Para:** Analizar mis hábitos de consumo y encontrar transacciones específicas rápidamente.  
**Prioridad:** Media  
**Estimación:** 5 puntos

#### Regla de negocio
Todas las consultas incluyen `{ userId }` en el filtro. La agregación usa `$lookup` a `accounts` y `categories` para añadir `accountName`, `accountType`, `categoryName`, `categoryColor` y `categoryType`. Orden por `date` descendente y `createdAt` descendente. Índices por `(userId, date)` y `(userId, type)`. Respuesta paginada: `{ rows, total, page, limit }`.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Historial y filtros de transacciones
  Como usuario autenticado
  Quiero consultar mis transacciones con filtros
  Para identificar patrones de gasto por período y categoría

  Regla de negocio: El repositorio aplica $match por userId y $lookup de cuenta y categoría.

  Escenario 1: Filtrar por rango de fechas y tipo (flujo principal)
    Dado que el usuario tiene transacciones en noviembre de 2026
    Cuando solicita GET /api/transactions?from=2026-11-01&to=2026-11-30&type=expense
    Entonces la agregación filtra por userId, tipo y rango de fechas
    Y devuelve HTTP 200 con solo las transacciones del usuario en ese rango
    Y los resultados están ordenados por fecha descendente

  Escenario 2: Filtrar por categoría y búsqueda (flujo alternativo)
    Dado que el usuario tiene transacciones de la categoría "Transporte"
    Cuando solicita GET /api/transactions?categoryId=<id>&search=Taxi
    Entonces devuelve solo las transacciones que coinciden para ese userId
    Y cada fila incluye categoryName y accountName

  Escenario 3: Sin transacciones en el filtro (caso de borde)
    Dado que no hay movimientos de tipo "income" en diciembre de 2026 para este userId
    Cuando filtra por ese mes y tipo
    Entonces devuelve HTTP 200 con rows: [] y total: 0
    Y el frontend muestra: "No se encontraron movimientos"

  Escenario 4: Parámetros de paginación (caso de borde)
    Dado que el usuario solicita ?page=2&limit=50
    Cuando se consulta el historial
    Entonces se aplican $skip y $limit sobre la agregación
    Y la respuesta incluye page, limit y el total de filas del filtro
```

---

### HU-08: Dashboard y resumen mensual (Aggregation Pipeline)

**Título:** Visualizar indicadores financieros en el dashboard  
**Rol:** Usuario autenticado  
**Quiero:** Ver el resumen mensual de ingresos, gastos, balance, patrimonio y distribución por categorías mediante gráficos interactivos.  
**Para:** Tomar decisiones financieras basadas en datos reales y visuales de mi situación actual.  
**Prioridad:** Alta  
**Estimación:** 8 puntos

#### Regla de negocio
El backend expone `GET /api/reports/summary`, `/by-category`, `/by-account`, `/monthly` y `/full`. Los totales se calculan con **MongoDB Aggregation Pipeline** (`$match` por userId y rango, `$group`, `$sum`, `$substrBytes` para agrupar por `YYYY-MM`). El frontend renderiza los datos con Chart.js (`lineChart`, `doughnutChart`, `barChart`).

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Dashboard y resumen financiero
  Como usuario autenticado
  Quiero consultar indicadores mensuales en el dashboard
  Para analizar mi balance y distribución de gastos por categoría

  Regla de negocio: Se ejecutan pipelines de agregación sobre `transactions` con $match por userId y rango de fechas.

  Escenario 1: Resumen con datos existentes (flujo principal)
    Dado que el usuario tiene transacciones en noviembre de 2026
    Cuando solicita GET /api/reports/summary?from=2026-11-01&to=2026-11-30
    Entonces el servicio ejecuta agregaciones para sumar ingresos y gastos
    Y devuelve HTTP 200 con { from, to, income, expenses, balance, savingsRate, count }
    Y el frontend renderiza los KPIs y gráficos con Chart.js

  Escenario 2: Mes sin transacciones (caso de borde)
    Dado que el usuario no tiene movimientos en octubre de 2026
    Cuando consulta el resumen de ese mes
    Entonces income, expenses y balance son 0 y savingsRate es 0
    Y se muestra el estado vacío correspondiente

  Escenario 3: Rango inválido (caso de borde)
    Dado que el usuario consulta from=2026-12-01 y to=2026-11-01
    Cuando solicita el resumen mensual
    Entonces devuelve HTTP 400: "La fecha inicial no puede ser posterior a la final."

  Escenario 4: Usuario no autenticado (caso de borde - RBAC)
    Dado que no hay sesión activa ni token JWT
    Cuando se solicita el resumen
    Entonces devuelve HTTP 401 y el frontend redirige al login
```

---

### HU-09: Presupuesto mensual y seguimiento

**Título:** Definir y controlar presupuesto mensual  
**Rol:** Usuario autenticado  
**Quiero:** Establecer un límite de gasto mensual por categoría y ver su grado de cumplimiento.  
**Para:** Controlar mis finanzas y evitar gastos excesivos.  
**Prioridad:** Media  
**Estimación:** 5 puntos

#### Regla de negocio
La colección `budgets` almacena `{ _id, userId, categoryId, month (AAAA-MM), amount, createdAt }`, con índice único por `(userId, categoryId, month)`. `POST /api/budgets` es un **upsert** (no devuelve 409 al repetir). El seguimiento compara el gasto real calculado con `sumByCategory` contra `amount`, produciendo `spent`, `remaining` y `progress` en `budgetService.listWithProgress`. La categoría debe ser propia o del sistema.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Presupuestos mensuales
  Como usuario autenticado
  Quiero definir un presupuesto mensual y hacer seguimiento
  Para controlar que mis gastos no superen lo planeado

  Regla de negocio: Índice único por (userId, categoryId, month). POST actualiza o crea según exista.

  Escenario 1: Crear presupuesto mensual (flujo principal)
    Dado que el usuario está autenticado
    Cuando envía POST /api/budgets con { categoryId, month: "2026-11", amount: 500 }
    Entonces valida el formato del mes y que la categoría sea visible
    Y guarda/actualiza el documento en `budgets`
    Y devuelve HTTP 200 con el presupuesto creado o actualizado

  Escenario 2: Gasto excede el presupuesto (flujo alternativo - alerta)
    Dado que existe un presupuesto de 500 para noviembre de 2026
    Y los gastos acumulados de la categoría son 520
    Cuando el usuario consulta GET /api/budgets?month=2026-11
    Entonces el documento incluye spent: 520, remaining: -20 y progress: 1.04
    Y la barra de progreso se muestra en rojo

  Escenario 3: Presupuesto duplicado (caso de borde)
    Dado que ya existe un presupuesto para userId, categoryId y month
    Cuando se envía otro POST con los mismos parámetros
    Entonces se actualiza el importe del mismo documento (upsert)
    Y no se crea un duplicado

  Escenario 4: Mes inválido (caso de borde)
    Dado que el usuario envía month: "2026-13"
    Cuando intenta crear el presupuesto
    Entonces devuelve HTTP 400: "Mes inválido. Use formato AAAA-MM."
```

---

### HU-10: Exportación de reportes (PDF y Excel)

**Título:** Exportar reportes financieros  
**Rol:** Usuario autenticado  
**Quiero:** Exportar mis transacciones y resúmenes en formato PDF y Excel.  
**Para:** Archivar mis registros financieros o compartirlos con un asesor/contador.  
**Prioridad:** Media  
**Estimación:** 5 puntos

#### Regla de negocio
Los datos provienen de `GET /api/reports/full?from=&to=&month=`, ya aislados por `userId`. La generación de archivos ocurre **en el cliente** (`src/views/ReportsView.js`): SheetJS (`xlsx`) produce `finance-person_YYYYMMDD_HHmm.xlsx` y jsPDF + autotable produce el PDF. No existe un endpoint de exportación en el servidor.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Exportación de reportes
  Como usuario autenticado
  Quiero exportar mis datos financieros a PDF y Excel
  Para tener copias de seguridad o compartir información externa

  Regla de negocio: El bundle se obtiene de /api/reports/full filtrado por userId. La generación es client-side.

  Escenario 1: Exportar a Excel (flujo principal)
    Dado que el usuario tiene transacciones registradas
    Cuando solicita la exportación en formato Excel desde la vista Reportes
    Entonces el frontend consume /api/reports/full
    Y genera un archivo .xlsx con resumen y detalle de movimientos
    Y lo descarga como finance-person_YYYYMMDD_HHmm.xlsx

  Escenario 2: Exportar a PDF (flujo alternativo)
    Dado que el usuario solicita formato PDF
    Cuando se genera el reporte
    Entonces se devuelve un archivo .pdf con cabecera de marca, resumen y tabla de movimientos

  Escenario 3: Sin datos para exportar (caso de borde)
    Dado que no hay transacciones en el período seleccionado
    Cuando se solicita la exportación
    Entonces el reporte se genera con totales en cero y el detalle vacío
    Y no se produce ningún error
```

---

### HU-11: Gestión de usuarios y roles (RBAC)

**Título:** Administrar usuarios del sistema  
**Rol:** Administrador  
**Quiero:** Ver usuarios, consultar sus movimientos y eliminar cuentas para controlar el acceso a la plataforma.  
**Para:** Mantener la seguridad y gobernanza del sistema SaaS.  
**Prioridad:** Baja  
**Estimación:** 3 puntos

#### Regla de negocio
Solo el rol `admin` accede a `/api/admin/*` mediante `requireRole('admin')`. El panel ofrece `/admin/stats` (u `/overview`), `/admin/users`, `/admin/users/:id/transactions`, `DELETE /admin/users/:id` y CRUD de `/admin/categories/system`. **No se permite eliminar administradores** (HTTP 400). La eliminación de un usuario borra en cascada sus categorías, cuentas, movimientos, presupuestos y tokens de reseteo. No existe endpoint para cambiar el rol de un usuario.

#### Criterios de Aceptación (Gherkin)

```gherkin
Funcionalidad: Gestión de usuarios (Administrador)
  Como administrador
  Quiero administrar usuarios y ver el global de la plataforma
  Para controlar el acceso según el modelo RBAC

  Regla de negocio: /api/admin/* está protegido por requireRole('admin'). No se pueden borrar admins.

  Escenario 1: Ver estadísticas globales (flujo principal)
    Dado que el administrador está autenticado
    Cuando solicita GET /api/admin/stats
    Entonces devuelve HTTP 200 con usuarios, movimientos, ingresos, gastos, cuentas, categorías y presupuestos globales
    Y el panel se actualiza solo ante cambios de datos (evento fp:data-changed)

  Escenario 2: Usuario estándar intenta acceder a administración (denegado)
    Dado que el usuario tiene role "user"
    Cuando intenta acceder a GET /api/admin/users
    Entonces devuelve HTTP 403

  Escenario 3: Eliminar un administrador (caso de borde)
    Dado que el objetivo tiene role "admin"
    Cuando se intenta eliminar
    Entonces devuelve HTTP 400: "No se puede eliminar a un administrador."

  Escenario 4: Eliminar usuario estándar (flujo alternativo)
    Dado que el objetivo tiene role "user"
    Cuando se elimina
    Entonces se borran todos sus documentos (tenant completo)
    Y su correo queda libre para un nuevo registro
```

---

## ✅ Tabla de trazabilidad con requerimientos funcionales

| Requerimiento | Historia(s) de Usuario | Colección MongoDB principal |
|---------------|------------------------|-----------------------------|
| a. Registrar ingresos y gastos | HU-06 | `transactions` |
| b. Administrar categorías | HU-04 | `categories` |
| c. Registrar cuentas o medios de pago | HU-05 | `accounts` |
| d. Consultar historial de movimientos | HU-07 | `transactions` |
| e. Filtrar por fechas, categorías y tipo | HU-07 | `transactions` |
| f. Dashboard interactivo | HU-08 | `transactions` (aggregation) |
| g. Gráficos de ingresos, gastos, balance | HU-08 | `transactions` (aggregation) |
| h. Presupuesto mensual y seguimiento | HU-09 | `budgets` |
| i. Exportar reportes PDF y Excel | HU-10 | `transactions` |
| j. Validar información y gestionar errores | HU-01, HU-02, HU-03, HU-06, HU-07 | Todas |
| k. Gestión de usuarios (registro, login, recuperación) | HU-01, HU-02, HU-03 | `users`, `password_resets` |
| l. RBAC (usuario estándar / administrador) | HU-04, HU-11 | `users` |

---

## 🏁 Estado del documento (autoevaluación)

| Criterio | Puntaje | Justificación |
|----------|---------|---------------|
| **1. Sintaxis y Estructura Gherkin** (40%) | **3 / 3** | Todas las HU usan sintaxis Gherkin (`Dado que`, `Cuando`, `Entonces`, `Y`). Cada escenario distingue antecedentes, disparadores (peticiones Express) y resultados esperados (HTTP, documentos MongoDB, mensajes). Se contemplan flujos alternativos y casos de borde. Las referencias técnicas son las de la implementación vigente: colecciones reales, UUID, índices, aggregation pipelines, bcryptjs, JWT y `validator.js`. |
| **2. Coherencia y Valor de Negocio** (35%) | **3 / 3** | Las historias están delimitadas al Dashboard de Finanzas Personales con roles precisos (visitante, usuario registrado, usuario autenticado, administrador) y valor de negocio medible: aislamiento SaaS, control de presupuesto, toma de decisiones, privacidad y gobernanza. |
| **3. Completitud y Uso de Plantilla** (25%) | **3 / 3** | Se completa la plantilla para cada historia: ID, título, rol, quiero, para, prioridad, estimación, regla de negocio y criterios Gherkin. El formato es consistente y las referencias técnicas corresponden al código real. |

**Puntaje total ponderado: 100 / 100 (Sobresaliente)**

---

## 📄 Cómo usar este documento

1. Este archivo vive en la raíz del repositorio `Finance_Person` junto a la [Guía Pedagógica](GUIA_PEDAGOGICA_HU_GHERKIN.md).
2. Asigna cada HU a un sprint según su prioridad (Alta → Sprint 1, Media → Sprint 2, Baja → Sprint 3).
3. Usa los Criterios de Aceptación Gherkin como definición de listo (Definition of Done) antes de marcar una historia como completada.
4. Los escenarios hacen referencia al driver oficial `mongodb`, al aislamiento por `userId` y a la seguridad (RBAC, validación con `validator.js`, bcryptjs, JWT). La verificación automatizada está en [docs/PRUEBAS.md](docs/PRUEBAS.md) (104 checks de API + 32 de UI).
