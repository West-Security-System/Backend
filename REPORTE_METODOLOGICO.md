## Información de la Issue

- ID y nombre: Backend B14 — Exponer servicios y horarios asignados al guardia.
- Repositorio/carpeta: west-security-backend, back/v14-issue-B14.
- Commit Git: HEAD consultado antes de editar: 7337ac0 (base, no atribuible a B14).
- Commit sugerido: feat(backend): documentar servicios asignados B14. Para publicar: git rev-parse --short HEAD y git push origin feature/backend-issue-B14-servicios-guardia.

## Registro Metodológico y Cambios Realizados

B14 agrega consultas autenticadas de los servicios y horarios asignados al guardia. La identidad procede de req.user y limita los datos propios. Los horarios exigen nombre válido y servicio asignado; si el guardia no tiene asignaciones, se devuelve colección vacía. Frente a B13 se añaden el módulo guardServices, middleware de guardia, persistencia y montaje de rutas.

- Routes: src/routes/guardServicesRoutes.js — GET /api/mis-servicios y GET /api/servicio/:nombre/horarios.
- Controllers: src/controllers/guardServicesController.js.
- Services: src/services/guardServicesService.js.
- Repositories: src/repositories/guardServicesRepository.js.
- Middlewares: src/middlewares/guardAuth.js.
- Utils: src/utils/apiError.js.
- Integración/persistencia: src/server.js, src/db.js.
- Test existente: test/issue14.test.js.

## Verificación de Criterios de Aceptación

- [x] Servicios y horarios quedan limitados al guardia autenticado.
- [x] Nombre inválido produce 422 y servicio no asignado 403.
- [x] Test cubre guardia asignado, guardia sin asignaciones y servicio ajeno.
- [ ] Test no ejecutado durante esta actualización.
- [ ] La matriz completa para sesión ausente/roles no aparece cubierta en el test visible.

## Evidencia de Funcionamiento y Pruebas

test/issue14.test.js inicia servidor/base temporal, crea admin, dos guardias, servicio, horario y asignación. Espera 200 con ids propios en ambas consultas, lista vacía 200 para el guardia no asignado y 403 para horarios de servicio ajeno. Comando disponible: npm test. No ejecutado aquí.
