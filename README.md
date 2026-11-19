<!-- calidad:inicio -->
![Calidad](https://img.shields.io/badge/Calidad-100%2F100-green) ![Aprobado](https://img.shields.io/badge/Aprobado-SI-green) ![Cumple](https://img.shields.io/badge/Cumple-15%2F15-green) ![Duplicación](https://img.shields.io/badge/Duplicaci%C3%B3n-5.9%25-green) ![SEC](https://img.shields.io/badge/SEC-0-green) ![SQL](https://img.shields.io/badge/SQL-0-green) ![DBG](https://img.shields.io/badge/DBG-0-green) ![Capas](https://img.shields.io/badge/Capas-3-green) ![Tests](https://img.shields.io/badge/Tests-24-green) ![Cob](https://img.shields.io/badge/Cob-94.7%25-green) ![EP](https://img.shields.io/badge/EP-39-green)

**Calidad de servicios (heurístico):** índice **100/100** · cumple **15/15** · aprobado **SI** · capas **3**
Detalle completo en [`docs/EVALUACION.md`](docs/EVALUACION.md).
<!-- calidad:fin -->

# West Security Backend B21

Backend REST para control de servicios de seguridad. La API usa Express, sesiones HTTP y SQLite mediante `sql.js`. Los ejemplos de rutas suponen el origen `http://localhost:3000`.

## Instalación limpia

```sh
cd back/v21-issue-B21/west-security-backend
npm install
cp .env.example .env
```

Configura en `.env` un `SESSION_SECRET` aleatorio y las credenciales iniciales del administrador. Para generar una clave de sesión en Linux/macOS:

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

En una terminal, levanta el servidor local:

```sh
npm run dev
```

En otra terminal, ejecuta las suites:

```sh
npm test
npm run test:coverage
```

`npm run test:coverage` ejecuta la suite `node:test` y aplica los mínimos configurados para líneas, funciones, ramas y sentencias.

## Docker

Desde `back/v21-issue-B21/west-security-backend`, crea `.env` desde la plantilla y establece claves aleatorias y credenciales locales:

```sh
cp .env.example .env
```

Levanta los dos contenedores:

```sh
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health
```

El servicio `backend` corre como usuario no-root, escucha en el puerto `3000` y persiste SQLite en `/app/data/west_control.db`. `db` es un contenedor auxiliar Alpine con `sqlite3` instalado; no es un servidor de base de datos. Ambos montan el volumen nombrado `west_security_db_data`, así que inspeccionan el mismo archivo.

Inspecciona tablas o consulta filas:

```sh
docker compose exec db sqlite3 /data/west_control.db '.tables'
docker compose exec db sqlite3 /data/west_control.db 'SELECT id, nombre FROM locales;'
```

Para un respaldo consistente, detén brevemente el backend, crea una copia SQLite y cópiala al host:

```sh
docker compose stop backend
docker compose exec db sqlite3 /data/west_control.db ".backup '/data/west_control.backup.db'"
docker compose cp db:/data/west_control.backup.db ./west_control.backup.db
docker compose start backend
```

La persistencia se puede comprobar con `docker compose down` seguido de `docker compose up -d --build` y una nueva consulta a `/data/west_control.db`. `docker compose down` conserva el volumen; no uses `docker compose down -v` salvo que quieras eliminar permanentemente la base persistida.

## Variables de entorno

Los valores de ejemplo no son credenciales válidas; deben reemplazarse en el entorno local.

| Variable | Uso | Ejemplo de desarrollo |
| --- | --- | --- |
| `PORT` | Puerto HTTP | `3000` |
| `APP_VERSION` | Versión informada por health | `0.1.0` |
| `DATABASE_PATH` | Ruta SQLite; local usa `./data/west_control.db`, Docker usa `/app/data/west_control.db` | `./data/west_control.db` |
| `CORS_ORIGIN` | Único origen web permitido | `http://localhost:5173` |
| `SESSION_SECRET` | Clave aleatoria para firmar sesiones; obligatoria | generar con el comando anterior |
| `SESSION_MAX_AGE_MS` | Vigencia de la cookie de sesión en milisegundos | `86400000` |
| `COOKIE_SECURE` | Requiere HTTPS para la cookie | `false` local; `true` tras HTTPS |
| `ADMIN_USERNAME` | Usuario administrador inicial/gestionado por arranque | definir en el entorno |
| `ADMIN_PASSWORD` | Contraseña inicial del administrador | definir en el entorno |

## SQLite

El esquema se crea de forma idempotente al iniciar (`CREATE TABLE IF NOT EXISTS`) y las inicializaciones corren dentro de una transacción.

| Tabla | Campos principales y relaciones |
| --- | --- |
| `schema_migrations` | `version` (PK), `applied_at` |
| `app_settings` | `key` (PK), `value` |
| `usuarios` | `id` (PK), `username` único, `password_hash`, `rol`, `bloqueado`, timestamps |
| `guardia_bloqueos` | `id`, `usuario_id` FK, tipo de bloqueo, fecha/rango, motivo y timestamps |
| `guardia_asignaciones` | `id`, `usuario_id` FK, fecha, motivo y creación |
| `locales` | `id`, nombre único, latitud, longitud y timestamps; representa el servicio |
| `guardia_locales` | relación de guardias y locales |
| `horarios` | `id`, `servicio_id` FK a locales, días, horas y capacidad |
| `guardia_horarios` | asignación guardia/horario, con unicidad por usuario y horario |
| `registros_operativos` | guardia, local, horario, ingreso/egreso, coordenadas, duración, estado y observaciones |
| `notificaciones` | `id`, `usuario_id` FK, título, mensaje, `leida`, `created_at`, `leida_at` |
| `valores_mensuales` | `id`, `servicio_id` FK a locales, `anio`, `mes`, `valor`, `updated_at`; único por servicio/año/mes |

Las sentencias de datos usan parámetros `?`. El reemplazo de bloqueos, la asignación acompañada de notificación y la eliminación múltiple usan `BEGIN`/`COMMIT`/`ROLLBACK`; el valor mensual se persiste mediante un único `UPSERT` atómico. La tabla mensual almacena solo el valor operativo básico: no gestiona pagos ni liquidaciones.

Con `DATABASE_PATH=:memory:` `sql.js` no crea carpetas ni escribe archivos; el modo se usa en tests aislados.

## Contrato HTTP

Todas las respuestas usan `{ "data": ..., "error": null }` en éxito y `{ "data": null, "error": { "code", "message", "fields?" } }` en error. Las rutas protegidas usan la cookie de sesión `connect.sid`. El JSON de error nunca contiene stack traces ni detalles internos de `500`.

| Método y ruta | Rol | Payload/query | Respuesta exitosa y errores principales |
| --- | --- | --- | --- |
| `GET /api/health` | Público | Ninguno | `200`: `data.status`, `data.version` |
| `POST /api/login` | Público | `{username, password}` | `200`: `data.user`; credenciales inválidas `401`; intento 31 en 15 min/IP `429` |
| `GET /api/me` | Sesión | Ninguno | `200`: usuario de sesión; sin sesión `401` |
| `POST /api/logout` | Público/sesión | Ninguno | `200`: `{loggedOut:true}` |
| `GET /api/admin/dashboard` | Admin | Ninguno | `200`: `data.dashboard`; `401`/`403` |
| `GET /api/admin/usuarios` | Admin | Ninguno | `200`: `data.usuarios`, sin `password_hash`; `401`/`403` |
| `POST /api/admin/usuarios` | Admin | `{username,password,rol,bloqueado?}` | `201`: `data.usuario`; datos inválidos `422`; duplicado `409`; `401`/`403` |
| `PUT /api/admin/usuarios` | Admin | `{id,username?,password?,rol?,bloqueado?}` | `200`: `data.usuario`; ID inexistente `404`; rol/ID inválido `422`; duplicado `409` |
| `DELETE /api/admin/usuarios` | Admin | `{id}` o `?id=` | `200`: `data.eliminado`; ID inválido `422`; inexistente `404`; autoeliminación `403` |
| `PUT /api/admin/usuarios/:id/bloqueos` | Admin | `{bloqueos:[{tipo:'fecha',fecha,motivo?}]}` o `[{tipo:'rango',fecha_inicio,fecha_fin,motivo?}]`; también acepta el arreglo directamente | `200`: `data.usuario_id` y bloqueos reemplazados; payload/rango inválido o asignación en conflicto `422`; usuario inexistente `404` |
| `GET /api/admin/locales` | Admin | Ninguno | `200`: `data.locales`; `401`/`403` |
| `POST /api/admin/locales` | Admin | `{nombre,latitud,longitud}` | `201`: `data.local`; datos/coordenadas inválidos `422`; nombre repetido `409` |
| `PUT /api/admin/locales` | Admin | `{id,nombre,latitud,longitud}` | `200`: `data.local`; inválido `422`; inexistente `404`; nombre repetido `409` |
| `DELETE /api/admin/locales` | Admin | `{id}` o `?id=` | `200`: `data.eliminado`; inválido `422`; inexistente `404`; relaciones activas `409` |
| `GET /api/admin/horarios` | Admin | `?servicio_id=` opcional | `200`: `data.horarios`; filtro inválido `422` |
| `POST /api/admin/horarios` | Admin | `{servicio_id,dias:[1..7],hora_inicio,hora_fin,capacidad}` | `201`: `data.horario`; payload inválido `422` |
| `PUT /api/admin/horarios` | Admin | Payload anterior más `id` | `200`: `data.horario`; inválido `422`; inexistente `404` |
| `DELETE /api/admin/horarios` | Admin | `{id}` o `?id=` | `200`: `data.eliminado`; inválido `422`; inexistente `404` |
| `GET /api/admin/horarios/:id/guardias` | Admin | Ninguno | `200`: `data.asignaciones`; horario inexistente `404` |
| `POST /api/admin/horarios/:id/guardias` | Admin | `{usuario_id}` | `201`: `data.asignacion`; guardia/horario inexistente `404`; rol/día inválido `422`; duplicado/capacidad/bloqueo `409` |
| `DELETE /api/admin/horarios/:id/guardias` | Admin | `{usuario_id}` | `200`: `data.desasignado`; inexistente `404` |
| `GET /api/admin/activos` | Admin | Filtros combinables: `guardia_id`/`usuario_id`, `servicio_id`/`local_id`, `estado`, `desde`, `hasta`, `limit` | `200`: `data.registros`, límite; filtros inválidos `422` |
| `GET /api/admin/registros` | Admin | Los mismos filtros; fechas ISO (`YYYY-MM-DD` o ISO 8601) | `200`: `data.registros`, orden descendente; filtros inválidos `422` |
| `GET /api/admin/registros/:id` | Admin | Ninguno | `200`: `data.registro` con guardia/local/horario; ID inválido `422`; no existe `404` |
| `PATCH /api/admin/registros/:id/cerrar` | Admin | `{hora_egreso: ISO-8601}` posterior al ingreso | `200`: registro cerrado con duración; fecha/ID inválido `422`; no existe `404`; ya cerrado `409` |
| `DELETE /api/admin/registros` | Admin | `{ids:[id,...]}` (1–500 IDs) | `200`: `resultado` con cantidad, eliminados y no encontrados; payload/ID inválido `422` |
| `GET /api/admin/calendario/:servicioId` | Admin | `?mes=1..12&anio=1000..9998` | `200`: `data.dias` agrupados en orden UTC; servicio inexistente `404`; ID inválido `422` |
| `GET /api/admin/valores-mensuales/:servicioId` | Admin | `?mes=1..12&anio=1000..9998` | `200`: valor operativo o `valor:null` si no existe; servicio `404`; filtro inválido `422` |
| `PUT /api/admin/valores-mensuales/:servicioId` | Admin | `{mes,anio,valor}`; `valor` numérico y no negativo | `200`: `data.valor_mensual`; servicio `404`; mes/año/valor inválido `422` |
| `GET /api/mis-servicios` | Guardia | Ninguno | `200`: `data.servicios`; `401` sin sesión, `403` rol no permitido |
| `GET /api/servicio/:nombre/horarios` | Guardia | Nombre en ruta | `200`: `data.horarios`; no asignado `403`; nombre inválido `422` |
| `POST /api/guardias` | Guardia | `{servicio_id,horario_id,latitud,longitud}` | `201`: ingreso abierto; fuera de 100 m/no autorizado `403`; coordenadas inválidas `422`; ingreso activo existente `409` |
| `POST /api/ingreso` | Guardia | `{local_id,latitud,longitud}` | `201`: `data.registro`; local/coordenadas inválidos `422` |
| `POST /api/egreso` | Guardia | `{latitud,longitud}` | `200`: registro cerrado; sin ingreso activo `404`; fuera del radio `403`; coordenadas inválidas `422` |
| `POST /api/guardias/egreso` | Guardia | `{latitud,longitud}` | Alias del egreso del turno activo; mismos estados que `/api/egreso` |
| `POST /api/guardias/:id/egreso` | Dueño o admin | `{latitud,longitud}` | `200`: misma fila cerrada; no autenticado `401`; otro dueño `403`; no existe `404`; cerrado `409`; coordenadas inválidas `422` |
| `GET /api/mis-registros` | Guardia | `?limit=1..100&offset=0..1000000` | `200`: historial propio, abierto/cerrado y vacío como `[]`; paginación inválida `422`; sin sesión `401` |
| `GET /api/notificaciones` | Usuario autenticado | `?limit=1..100` (predeterminado 50) | `200`: notificaciones propias, `no_leidas`, `limite_maximo:100`; límite inválido `422`; sin sesión `401` |
| `POST /api/notificaciones/leidas` | Usuario autenticado | Ninguno | `200`: cantidad marcada; repetir devuelve `200` y cero cambios; sin sesión `401` |

## Seguridad y validaciones

- El login permite 30 intentos por IP en una ventana de 15 minutos; el 31.º devuelve `429`. La ventana se cuenta tanto para éxito como para fallo. `resetLoginRateLimit()` está exportada para tests.
- Se deshabilita `X-Powered-By`; todas las respuestas llevan `nosniff`, `DENY`, `no-referrer` y `same-site`.
- El middleware `sanitizePayload` sanea body/query, elimina claves de prototipo y campos sensibles no aceptados; preserva `password` sin transformarlo para autenticarlo/hashearlo.
- Los valores de base de datos se enlazan mediante `?`. No se registran secretos y los errores internos no incluyen stack traces.
- Las coordenadas usan latitud `[-90,90]` y longitud `[-180,180]`; el ingreso por `/api/guardias` exige estar dentro de 100 metros del servicio.
- El calendario interpreta timestamps en UTC, usa el intervalo semiabierto `[inicio, fin)` y devuelve días en orden cronológico.

## Formato de errores

| Estado | Significado habitual |
| --- | --- |
| `400` | JSON malformado |
| `401` | Sesión ausente/inválida o credenciales de login incorrectas |
| `403` | Rol/propiedad/origen/radio geográfico no autorizado |
| `404` | Recurso no encontrado |
| `409` | Conflicto de unicidad, estado, asignación o capacidad |
| `422` | Campo, coordenada, fecha, mes/año o payload inválido |
| `429` | Límite de intentos de login excedido |

Los errores inesperados usan `500` con un mensaje genérico. No se devuelven credenciales, cookies, tokens, `SESSION_SECRET` ni stacks.
