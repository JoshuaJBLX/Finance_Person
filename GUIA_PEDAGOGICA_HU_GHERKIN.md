# 📘 Guía Pedagógica y Práctica: Historias de Usuario y Gherkin

**Instructivo metodológico, marco conceptual INVEST/BDD y especificación práctica aplicada al módulo de Checkout de Mercado Libre.**

---

## 1. Marco Teórico y Conceptual

En el desarrollo ágil de software, las Historias de Usuario (HU) actúan como un vehículo de comunicación directo entre el equipo de negocio y el equipo técnico. Para garantizar su calidad, deben cumplir estrictamente con el acrónimo **INVEST**:

### 💡 Principios Criterio INVEST

| Criterio | Descripción |
|----------|-------------|
| **I - Independent (Independiente)** | Evitar acoplamientos entre historias para permitir entregas modulares. |
| **N - Negotiable (Negociable)** | Centrada en el "qué" y no en el "cómo", abierta al diálogo técnico. |
| **V - Valuable (Valiosa)** | Debe aportar un valor claro y directo al usuario o al negocio. |
| **E - Estimable (Estimable)** | Su alcance debe ser claro para permitir una estimación de esfuerzo razonable. |
| **S - Small (Pequeña)** | Adecuada en dimensión para completarse dentro de un solo sprint. |
| **T - Testable (Testeable)** | Debe contar con criterios de aceptación objetivos para su verificación. |

Para operacionalizar la verificabilidad (**Testable**), se adopta **BDD (Behavior-Driven Development)** mediante el lenguaje **Gherkin** (`Dado que`, `Cuando`, `Entonces`), estandarizando el comportamiento esperado en un formato comprensible tanto para personas de negocio como para desarrollo y QA.

---

## 2. Instructivo de Registro Normativo

### 2.1 Componentes de la Historia de Usuario

| Columna | Instrucciones de Redacción |
|---------|---------------------------|
| **Identificador (ID) de la historia** | Código único estandarizado que identifica unívocamente la historia en el backlog (ej. HU-001, HU-CHECKOUT-02). |
| **Rol** | Especifica el perfil de usuario o actor que interactúa con la funcionalidad. Debe evitarse la ambigüedad (ej. "Yo como comprador registrado" en lugar de "como usuario"). |
| **Característica / Funcionalidad** | Expresa la acción o necesidad que el rol ejecuta en el sistema mediante verbos de acción ("quiero consultar", "necesito filtrar", "puedo seleccionar"). |
| **Razón / Resultado** | Describe el beneficio directo, meta o valor de negocio que justifica la implementación de la característica ("Para poder [beneficio/meta]"). |

### 2.2 Componentes de los Criterios de Aceptación (Sintaxis Gherkin)

| Columna | Instrucciones y Definición Técnica |
|---------|------------------------------------|
| **Número (#) de Escenario** | Secuencial numérico estructurado que identifica cada caso de prueba (ej. Escenario 1, Escenario 2). |
| **Scenario (Escenario)** | Título descriptivo y concreto que resume el propósito del caso de uso evaluado (ej. Compra exitosa con tarjeta de crédito). |
| **Given (Dado / Dado que)** | Define la precondición o el contexto inicial indispensable antes de ejecutar cualquier interacción. |
| **When (Cuando)** | Especifica la acción del usuario, el evento de entrada o el estímulo ejecutado en la interfaz/sistema. |
| **Then (Entonces)** | Detalla las consecuencias observables, cambios de estado, almacenamiento de datos o mensajes de respuesta devueltos. |
| **And / But (Y / Pero)** | Conectores lógicos opcionales utilizados para encadenar múltiples precondiciones, acciones o resultados sin repetir palabras clave. |

---

## 3. Ejemplo Práctico Integral: Módulo de Compras en Mercado Libre

### Historia de Usuario 1: HU-01 - Búsqueda y filtrado de productos en el catálogo

📁 **Estructura del Formulario**

**ID:** HU-01  
**Rol:** Como comprador registrado  
**Funcionalidad:** Quiero buscar productos mediante términos clave y aplicar filtros de precio y modalidad de envío  
**Razón / Resultado:** Para encontrar rápidamente artículos relevantes que se ajusten a mi presupuesto y requerimientos de entrega.

#### Criterios de Aceptación en Sintaxis Gherkin (HU-01)

# Escenario 1: Camino Feliz (Happy Path)

DADO QUE el comprador se encuentra en la página principal de Mercado Libre

CUANDO ingresa "auriculares inalámbricos" en el buscador, aplica el filtro "Envío gratis" y define un rango de precio entre 50 y 150 USD

ENTONCES el sistema despliega un listado de productos que coinciden con el término de búsqueda y cumplen simultáneamente con el filtro de precio y envío sin costo.

# Escenario 2: Flujo Alternativo (Alternative Path)

DADO QUE el comprador ha ejecutado una búsqueda de "auriculares inalámbricos"

CUANDO selecciona la opción de ordenamiento "Menor precio"

ENTONCES el sistema reorganiza la lista de resultados mostrando los artículos de menor a mayor costo de manera ascendente.

# Escenario 3: Manejo de Errores (Error Path)

DADO QUE el comprador está configurando el filtro de rango de precios

CUANDO ingresa un precio mínimo de 200 USD y un precio máximo de 50 USD

ENTONCES el sistema muestra la alerta "El precio mínimo no puede ser mayor al precio máximo" y deshabilita el botón de aplicación de filtros.

# Escenario 4: Caso de Borde (Edge Case)

DADO QUE el comprador busca un código de producto alfanumérico inexistente ("X-999-NOTFOUND")

CUANDO presiona la tecla de búsqueda

ENTONCES el sistema muestra la pantalla informativa "No encontramos resultados para tu búsqueda" junto con una lista de categorías recomendadas.

---

### Historia de Usuario 2: HU-02 - Gestión e incorporación de productos al carrito de compras

📁 **Estructura del Formulario**

**ID:** HU-02  
**Rol:** Como comprador registrado  
**Funcionalidad:** Quiero agregar artículos seleccionados con una cantidad específica al carrito de compras  
**Razón / Resultado:** Para consolidar los productos que deseo adquirir en una sola orden de compra.

#### Criterios de Aceptación en Sintaxis Gherkin (HU-02)

# Escenario 1: Camino Feliz (Happy Path)

DADO QUE el comprador está en la página de detalle de un producto con stock disponible de 10 unidades

CUANDO selecciona la cantidad de 2 unidades y hace clic en "Agregar al carrito"

ENTONCES el sistema añade las 2 unidades al carrito, actualiza el indicador numérico del icono del carrito y despliega la confirmación flotante.

# Escenario 2: Flujo Alternativo (Alternative Path)

DADO QUE el comprador posee 2 productos dentro de su carrito de compras

CUANDO accede a la vista de su carrito y hace clic en la opción "Eliminar" de uno de los artículos

ENTONCES el sistema remueve dicho producto de la lista y recalcula de forma automática el monto subtotal del carrito.

# Escenario 3: Manejo de Errores (Error Path)

DADO QUE el comprador se encuentra en la ficha técnica del producto seleccionado

CUANDO intenta ingresar manualmente un valor de cantidad negativo ("-2") o cero ("0")

ENTONCES el sistema restaura el valor del campo a 1 y muestra la advertencia "La cantidad mínima requerida es 1 unidad".

# Escenario 4: Caso de Borde (Edge Case)

DADO QUE el producto seleccionado cuenta únicamente con 1 unidad disponible en inventario

CUANDO el comprador intenta seleccionar 2 unidades dentro de la ficha de detalle

ENTONCES el sistema deshabilita el selector de incremento, muestra el mensaje "¡Última unidad disponible!" y limita la selección a 1 unidad.


---

### Historia de Usuario 3: HU-03 - Procesamiento y confirmación de pago de la orden

📁 **Estructura del Formulario**

**ID:** HU-03  
**Rol:** Como comprador registrado  
**Funcionalidad:** Quiero procesar el pago de mi carrito de compras utilizando una tarjeta de crédito o saldo disponible  
**Razón / Resultado:** Para completar la transacción de compra y autorizar la entrega de los productos.

#### Criterios de Aceptación en Sintaxis Gherkin (HU-03)

# Escenario 1: Camino Feliz (Happy Path)

DADO QUE el comprador tiene un carrito con productos, ha seleccionado su dirección de envío e ingresó una tarjeta de crédito válida con fondos suficientes

CUANDO presiona el botón "Pagar"

ENTONCES el sistema aprueba la transacción, genera un identificador único de orden, descuenta el stock de la base de datos y envía el comprobante al correo registrado.

# Escenario 2: Flujo Alternativo (Alternative Path)

DADO QUE el comprador se encuentra en el checkout de la compra

CUANDO selecciona como medio de pago "Dinero disponible en Mercado Pago" con saldo suficiente y confirma la operación

ENTONCES el sistema debita el monto directamente de su cuenta y emite la confirmación de la orden de forma inmediata.

# Escenario 3: Manejo de Errores (Error Path)

DADO QUE el comprador efectúa el pago con una tarjeta de crédito que ha superado su límite de crédito

CUANDO confirma el intento de pago

ENTONCES el sistema rechaza la transacción y muestra el mensaje "Pago rechazado por el emisor. Por favor intenta con otro medio de pago".

# Escenario 4: Caso de Borde (Edge Case)

DADO QUE el comprador permanece inactivo en la pantalla de revisión de pago durante más de 15 minutos

CUANDO intenta hacer clic en el botón "Pagar" una vez expirado el tiempo de reserva

ENTONCES el sistema cancela la sesión de checkout, invalida la orden temporal y redirige al carrito con la notificación "Tu sesión ha expirado por inactividad. Revisa la disponibilidad actual de tus productos".


---

## 4. Checklist de Validación para el Estudiante

### ☑ Lista de Cotejo de Calidad de Historias

| Ítem | Pregunta de validación | ✅ / ❌ |
|------|------------------------|---------|
| **Independencia funcional** | ¿La Historia de Usuario se puede desarrollar sin depender de historias del mismo sprint? | |
| **Formato de rol/deseo/beneficio** | ¿Utiliza una estructura clara que especifique el Rol, la Funcionalidad y el Valor de Negocio? | |
| **Cumplimiento de Sintaxis Gherkin** | ¿Cada criterio de aceptación emplea correctamente las cláusulas Dado que (contexto), Cuando (acción) y Entonces (resultado)? | |
| **Cobertura integral de pruebas** | ¿Cada Historia incluye los 4 escenarios obligatorios? | |
| | ✓ Camino Feliz (Happy Path) | |
| | ✓ Flujo Alternativo | |
| | ✓ Manejo de Errores | |
| | ✓ Caso de Borde / Límites | |
| **Ausencia de ambigüedad técnica** | ¿Los resultados en las cláusulas Entonces son verificables y evaluables de manera objetiva por el equipo de QA? | |
