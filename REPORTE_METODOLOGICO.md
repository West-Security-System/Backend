## Información de la Issue

- ID y nombre: Backend B13 — Exponer resumen operativo administrativo.
- Repositorio/carpeta: west-security-backend, back/v13-issue-B13.
- Commit Git: HEAD consultado antes de editar: 7337ac0 (base del workspace, no atribuible a B13).
- Commit sugerido: feat(backend): documentar resumen operativo admin B13. Para publicar: git rev-parse --short HEAD y git push origin feature/backend-issue-B13-resumen-operativo.

## Registro Metodológico y Cambios Realizados

B13 agrega las consultas administrativas de registros activos e historial. Las rutas requieren admin; controladores delegan al servicio; el servicio valida ids, fechas y rangos, limita resultados a 50 por defecto y 100 máximo y normaliza timestamps a ISO 8601; el repositorio consulta datos persistidos. La respuesta usa { data, error }. Frente a B12 se incorpora el módulo de resumen operativo y se integra en servidor/base de datos.

- Routes: src/routes/adminOperationalRoutes.js — GET /api/admin/activos y /api/admin/registros.
- Controllers: src/controllers/operationalSummaryController.js.
- Services: src/services/operationalSummaryService.js — filtros, fechas y límites.
- Repositories: src/repositories/operationalRecordsRepository.js.
- Middlewares: src/middlewares/adminAuth.js.
- Utils: src/utils/apiError.js.
- Integración/persistencia: src/server.js, src/db.js.
- Test existente: test/issue13.test.js.

## Verificación de Criterios de Aceptación

- [x] Activos e historial tienen rutas administrativas distintas.
- [x] Filtros de local, usuario, fechas y límite se validan; máximo 100.
- [x] Las fechas de salida se serializan en ISO 8601.
- [x] El test contiene casos 401 anónimo, 403 guardia, 200 admin, vacío, límite y fecha inválida 422.
- [ ] Test no ejecutado durante esta actualización; revisión estática solamente.
- [ ] No hay aserción visible con registros existentes ni cobertura de cada filtro.

## Evidencia de Funcionamiento y Pruebas

test/issue13.test.js prepara servidor/base temporal. Aserta GET /api/admin/registros?limit=999 → 200, data.limite=100; fecha inválida → 422; sin sesión → 401; guardia → 403. Comando disponible: npm test desde esta carpeta. No se ejecutó en este trabajo.
