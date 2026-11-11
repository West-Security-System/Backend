# Reporte metodológico — Issue 16

## Alcance y arquitectura

- Se copió la base de B15 a `west-security-backend/`; todos los cambios de esta entrega quedan dentro de `back/v16-issue-B16/`.
- Se conserva la separación existente `src/routes/`, `src/controllers/`, `src/services/`, `src/repositories/`, `src/middlewares/`, `src/utils/`, `test/`, `tests/` y `src/server.js`.
- El ingreso B16 se implementa en rutas, controlador, servicio y repositorio propios; la persistencia se integra con SQLite mediante consultas parametrizadas.

## Cambios realizados

- Se agregó `src/utils/geo.js` con distancia Haversine en metros, incluyendo manejo numérico estable para coordenadas antipodales.
- Se agregó `POST /api/guardias`, protegido por autenticación de guardia y validación de coordenadas.
- El servicio comprueba servicio existente, horario asignado al guardia y distancia al servicio. Acepta distancias de hasta 100 m; distancias mayores devuelven 403 antes de cualquier inserción.
- Se persisten servicio, horario, coordenadas, timestamp generado por el servidor y estado `abierto`. La base conserva compatibilidad con el ingreso/egreso anterior mediante migración de columnas; al cerrar un registro, su estado pasa a `cerrado`.
- Los errores internos se centralizaron en middleware comprobable; los errores inesperados responden 500 sin exponer detalles en producción.
- Se amplió la suite de unidad e integración: ahora hay 13 archivos de pruebas entre `test/` y `tests/`, con casos 200/201, 401, 403, 404, 409, 422 y 500.
- `npm run test:coverage` instrumenta todos los archivos JavaScript bajo `src/`, aplica umbrales de 85% de líneas/sentencias, 85% de funciones y 75% de ramas, y genera `coverage/coverage-summary.json`, `coverage/cobertura-coverage.xml` y `coverage/coverage.xml`.

## Verificación y cobertura

- [x] `npm test`: 30 pruebas aprobadas.
- [x] `npm run test:coverage`: gate de cobertura aprobado sobre `src/**/*.js`, incluyendo `src/server.js` y `src/db.js`.
- [x] Cobertura de líneas/sentencias: 90.82% (1,802/1,983); funciones: 100%; ramas: 80.16%. Valores registrados en `west-security-backend/coverage/coverage-summary.json`.
- [x] Distancia dentro de 100 m aceptada; fuera del radio rechazada con 403 sin crear filas.
- [x] Ingreso guarda horario, coordenadas, timestamp y estado abierto; un segundo ingreso activo devuelve 409.
- [x] La suite unitaria y de integración cubre autenticación, permisos, validación, persistencia y el manejo seguro de errores 500.

## Checklist de aceptación

- [x] Arquitectura por capas conservada.
- [x] Haversine implementado y probado para coordenadas idénticas, ecuatoriales, polares, antimeridiano y antipodales.
- [x] Endpoint `POST /api/guardias` autenticado.
- [x] Registro dentro del radio con estado `abierto`.
- [x] HTTP 403 para distancia mayor a 100 m y verificación de ausencia de inserción.
- [x] Cinco o más archivos de test y cobertura automatizada con artefactos generados.
- [x] Consultas SQL parametrizadas; sin credenciales nuevas hardcodeadas ni sentencias de depuración.
