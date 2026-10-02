# Reporte metodológico - Backend Issue B09

## Estrategia de ramas

- Backend: `feature/backend-issue-B09-guard-bloqueos`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(admin): agregar tabla de bloqueos por guardia B09`

## Borrador del Pull Request

### Título

`feat(backend): gestionar indisponibilidades de guardias`

### Referencia de cierre

`Fixes backend#B09`

### Resumen

Se extiende el backend B08 con la estructura necesaria para registrar indisponibilidades de guardias por fecha o rango, y se incorpora la ruta protegida `PUT /api/admin/usuarios/:id/bloqueos`. La operación valida el payload, evita formatos inválidos con 422 y rechaza cambios cuando el guardia ya tiene asignaciones en los días solicitados.

### Checklist

- [ ] Se crea la tabla `guardia_bloqueos` para fechas y rangos de indisponibilidad.
- [ ] `PUT /api/admin/usuarios/:id/bloqueos` requiere autenticación y rol de administrador.
- [ ] El payload acepta `fecha` o `rango` con `fecha_inicio`/`fecha_fin` en formato ISO válido.
- [ ] Formatos inválidos responden 422 Unprocessable Entity.
- [ ] La operación rechaza días con asignaciones vigentes del guardia.
- [ ] No se tocaron rutas de `front/`.
- [ ] La raíz de `v09-issue-B09` contiene únicamente `west-security-backend/`.
