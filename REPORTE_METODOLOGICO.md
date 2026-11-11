# Reporte metodológico — Issue 17

## Alcance y arquitectura

- Se copió la base B16 a `back/v17-issue-B17/west-security-backend/`; todos los cambios de esta entrega quedan dentro de `back/v17-issue-B17/`.
- Se conserva la separación `src/routes/`, `src/controllers/`, `src/services/`, `src/repositories/`, `src/middlewares/`, `src/utils/`, `test/`, `tests/` y `src/server.js`.
- No se copiaron credenciales locales ni la base de datos de desarrollo. Las credenciales y secretos de ejecución continúan obteniéndose exclusivamente desde variables de entorno; `.env.example` contiene valores de ejemplo.

## Cambios realizados

- Se implementó `POST /api/guardias/egreso`, protegido por la sesión de guardia y el middleware de validación de latitud/longitud. Se mantiene `POST /api/egreso` como ruta compatible.
- El servicio obtiene el turno abierto y las coordenadas del servicio asociado. Calcula la distancia con el Haversine reutilizable de `src/utils/geo.js`; acepta hasta 100 metros inclusive y rechaza una distancia mayor con HTTP 403, sin cerrar el turno.
- En el cierre se usa timestamp UTC del servidor, se calcula duración total en segundos y se persisten la ubicación de salida, `hora_egreso`, `duracion_segundos` y estado `cerrado`.
- Se añadió la migración de esquema 10 para `duracion_segundos`. Las filas históricas se conservan; su duración queda nula si el cierre ocurrió antes de la migración.
- Se contemplan turno inexistente (404), cierre concurrente (409), coordenadas inválidas (422), sesión no autenticada (401) y fallos internos (500) mediante el manejador existente.
- Se añadieron pruebas unitarias, de integración y persistencia. La suite contiene 16 archivos de prueba entre `test/` y `tests/`.
- `npm run test:coverage` instrumenta `src/**/*.js`, aplica gates de 85% para líneas/sentencias, 85% para funciones y 75% para ramas, y genera `coverage/coverage-summary.json`, `coverage/cobertura-coverage.xml` y `coverage/coverage.xml`.

## Verificación y cobertura

- [x] `npm test`: 39 pruebas aprobadas.
- [x] `npm run test:coverage`: gate aprobado para todos los archivos fuente bajo `src/`.
- [x] Cobertura global: 91,09% líneas/sentencias, 100% funciones y 81,36% ramas. Fuente: `west-security-backend/coverage/coverage-summary.json`.
- [x] Se verificó el límite de 100 metros inclusive y el rechazo fuera de rango; el intento rechazado conserva el turno abierto.
- [x] Se verificó persistencia del timestamp, duración en segundos, coordenadas y estado cerrado, además de compatibilidad de migración.
- [x] `node --check` pasó en los archivos JavaScript de `src/`, `test/` y `tests/`.
- [x] No se encontraron `console.log`, `console.error` ni `debugger` en código de producción.
- [x] Se generaron los reportes JSON y Cobertura XML solicitados.

La cobertura y los casos funcionales se verificaron localmente. La puntuación exacta de “Calidad 100/100” depende del evaluador externo; no se afirma como certificada sin ejecutar esa herramienta.

## Checklist de aceptación

- [x] Estructura por capas preservada.
- [x] Endpoint autenticado `POST /api/guardias/egreso` implementado y ruta anterior conservada.
- [x] El egreso requiere turno abierto y servicio relacionado.
- [x] Geolocalización de egreso hasta 100 m inclusive; 403 fuera del radio y sin cerrar el registro.
- [x] Duración en segundos calculada y guardada; turno marcado `cerrado`.
- [x] Respuestas verificadas: 200, 401, 403, 404, 409 y 422; manejo 500 cubierto en la suite existente.
- [x] 16 archivos de prueba, 39 pruebas aprobadas y cobertura superior al 80%.
- [x] SQL parametrizado en las nuevas consultas y actualizaciones; sin sentencias de depuración.
- [x] Artefactos `coverage/coverage-summary.json` y `coverage/coverage.xml` generados.
