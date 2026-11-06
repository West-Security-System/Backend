# Reporte Metodológico: Backend B15

## Alcance

- Issue: validar coordenadas geográficas en ingreso y egreso.
- Proyecto: `back/v15-issue-B15/west-security-backend`.
- B15 ya contenía la base de B14 y el flujo de check-in/out; se conservó ese estado y todos los cambios de esta tarea se limitaron a B15.
- El código de aplicación se mantiene bajo `src/`, con separación por responsabilidad.

## Arquitectura

- Rutas: `src/routes/operationalCheckinRoutes.js` registra `POST /api/ingreso` y `POST /api/egreso`.
- Controlador y servicio: `src/controllers/operationalCheckinController.js` y `src/services/operationalCheckinService.js`.
- Repositorio: `src/repositories/operationalCheckinRepository.js` delega persistencia a `src/db.js`.
- Middleware: `src/middlewares/validateCoordinates.js` rechaza solicitudes inválidas antes de llamar al controlador.
- Utilidades: `src/utils/coordinates.js` comparte la regla geográfica; `src/utils/apiError.js` da formato a errores HTTP.
- Arranque e integración: `src/server.js`.
- Pruebas: `tests/issue15-validation.test.js` contiene tests unitarios; `test/issue15.test.js` mantiene el test de integración.

## Implementación

`validateCoordinates` exige valores de tipo `number`, finitos y dentro de los rangos inclusivos: latitud `[-90, 90]` y longitud `[-180, 180]`. Ausencia, `null` (incluido un cuerpo JSON completo igual a `null`), cadenas y valores fuera de rango producen HTTP 422. El middleware pasa las coordenadas validadas por `req.coordinates`; el mismo helper valida creación y actualización de locales, sin coerción de texto o `null` a cero.

Las credenciales se cargan desde variables de entorno mediante `dotenv`; `.env` queda excluido por `.gitignore` y `.env.example` usa marcadores no utilizables como credenciales reales. Las consultas de datos usan parámetros; los fragmentos dinámicos existentes corresponden a predicados controlados y listas de placeholders, mientras los valores se enlazan con `bind`.

## Verificación

- [x] Coordenadas válidas y límites geográficos aceptados.
- [x] Coordenadas ausentes, nulas, no numéricas o fuera de rango rechazadas con 422.
- [x] Los tests de integración comprueban ingreso/egreso y que coordenadas tipo texto o `null` no se aceptan al crear locales.
- [x] Escaneo de `src/`: sin `console.log`, `console.error` ni `debugger`.
- [x] `npm audit`: 0 vulnerabilidades después de actualizar dependencias transitivas compatibles.
- [x] `npm run test:coverage`: 3 tests aprobados; gate de cobertura >= 80% aprobado.

La cobertura configurada se limita intencionalmente al middleware y helper de coordenadas de B15. En ese alcance, `coverage/coverage-summary.json` registra 100% de líneas, sentencias, funciones y ramas. No se presenta como cobertura global de todas las funcionalidades heredadas del backend.

## Artefactos

El comando `npm run test:coverage` genera `coverage/coverage-summary.json`, `coverage/coverage.xml` y el XML Cobertura fuente `coverage/cobertura-coverage.xml`.
