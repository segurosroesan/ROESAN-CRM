# Base de Conocimiento para Agente IA - Integración CRM ROESAN y Softseguros

Este documento consolida todos los hallazgos técnicos, reglas de negocio y estructuras implementadas en el entorno de pruebas para la integración del CRM ROESAN con la API de Softseguros. Está diseñado para transferir el contexto rápidamente a otro proyecto o agente de IA.

## 1. Arquitectura General y Stack Tecnológico

El desarrollo contempla un CRM a medida diseñado para centralizar prospectos y automatizar su ingreso a Softseguros una vez convertidos.

*   **Frontend / Framework:** React / Vite / Next.js (por definir componente final).
*   **Base de Datos / Motor en Tiempo Real:** **InstantDB** (App ID: `b389dc19-2c05-488d-9bf4-43d12abd95e0`).
*   **Repositorio Web:** GitHub (`https://github.com/Jorge80H/ROESAN-CRM.git`).
*   **Fuentes de Leads:** Formularios del sitio web (`roesan.com`), Campañas de Meta (Facebook/Instagram), y un Agente de IA por WhatsApp.

### Flujo de Negocio (Pipeline)
1.  **Captura:** El lead ingresa desde la fuente a InstantDB. El estado inicial es 'Nuevo'.
2.  **Sistema de Tareas:** Al ingresar el lead, se genera una "Tarea de Cotización" automatizada.
3.  **Gestión Documental:** En la conversión del lead a cliente, el sistema requiere adjuntar el PDF de la póliza emitida.
4.  **Sincronización:** Una vez cerrado, los datos del cliente se envían a Softseguros a través de su API para alimentar el sistema principal de ROESAN.

## 2. Integración Web con InstantDB (Captura de Leads)

Para inyectar leads desde fuentes web al CRM en tiempo real, se cuenta con un modelo soportado por transacciones:

*   **Implementaciones:** Soporte vía CDN para HTML/JS clásico o npm (`@instantdb/core`) para frameworks modernos.
*   **Transacciones Atómicas:** El código base usa `db.transact([])` para insertar simultáneamente la información en las colecciones `leads` (con información de contacto) y `tasks` (descripción y asociación de cotización) garantizando la consistencia de los datos.

## 3. Especificaciones de la API de Softseguros

El entorno de pruebas interactúa con el endpoint base: `https://app.softseguros.com/api`.

### Autenticación
*   **Método Recomendado:** Autenticación por Token.
*   **Obtención:** `POST /api-token-auth/` mediante body JSON con `username` y `password`.
*   **Uso:** Envío del header `Authorization: Token <token_recibido>` en cada petición subsecuente.

### Descubrimientos, Bugs y Limitaciones Relevantes
1.  **Bloqueo por Permisos:**
    *   **Acceso Parcial Activo:** Solo lectura para `/poliza/`, `/aseguradoras/`, `/subramo/`, `/contacto/`, `/pago/`.
    *   **Aceso Denegado (HTTP 401/403):** El componente fundamental `/cliente/` está bloqueado para el usuario actual (`carmene.estrada`). Tampoco hay acceso a ramos ni siniestros.
    *   *Nota Crítica:* Para que el CRM pueda crear clientes al final del embudo, Soporte de Softseguros debe habilitar explicitamente permisos en el módulo Clientes.
2.  **Comportamiento Anómalo en Búsquedas:**
    *   Los parámetros de búsqueda (ej. `?search=` o `?numero_poliza=`) **no indexan ni filtran correctamente** todas las pólizas, lo que lleva a falsos negativos.
    *   **Solución probada:** Para ubicaciones precisas o integrales, fue necesario programar un algoritmo que descarga todos los elementos página por página, manipulando el atributo `next` de la respuesta JSON para iterar completamente las colecciones (más de 6,800 pólizas).
3.  **Estructura de Datos Útil de Pólizas:**
    Durante las lecturas, estos son los campos principales en las respuestas:
    *   `id` (Referencia interna del sistema) y `numero_poliza` (Referencia comercial).
    *   `estado_poliza_nombre`, `estado_poliza_codigo` (Ej: Vigente: 45911)
    *   `cliente_numero_documento`, `cliente_nombres`, `cliente_apellidos`
    *   Anidaciones importantes para relaciones: `aseguradora.nombre` y `ramo.nombre`.
    *   Fechas de vigencia: `fecha_inicio`, `fecha_fin`.

## 4. Scripts y Herramientas Transferibles

Se documentan los scripts Node.js ya estructurados y validados que interactúan con la API:
*   `test_auth.js`: Patrón básico de solicitud de token y estructura de petición HTTP.
*   `test_permissions.js`: Iteración y análisis automatizado de 13 endpoints para documentar y verificar los niveles de acceso del token actual identificando códigos HTTP.
*   `search_poliza.js`: Herramienta algorítmica de búsqueda intensiva página por página. Evita el bug de filtros de Softseguros extrayendo manualmente el `target` sobre toda la colección paginada.
*   `export_polizas_csv.js`: Rutina de extracción de datos que consolida y mapea métricas hacia un `.csv` de respaldo para análisis en crudo sin depender de la UI.

## Recomendaciones para el Nuevo Agente IA

1.  **Paginación:** No confíes en los parámetros convencionales de búsqueda filtrada de Softseguros si un registro "no aparece"; mejor itera sobre `next` en conjuntos (ej: `?page_size=100`).
2.  **Preparación de API:** Antes de desarrollar el módulo "Ganado/Cliente" del CRM para inyectar datos (POST) a Softseguros, detén la ejecución y verifica con el usuario si los permisos para `POST /cliente/` ya fueron habilitados administrativamente.
3.  **Ambientes:** Reutiliza las funciones de peticiones base (como `fetchA` en el código de exportación) que resuelven los headers, el error handling y el manejo de respuestas a JSON.
