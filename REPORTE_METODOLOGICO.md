# Reporte metodológico - Backend Issue B12

## Estrategia de ramas

- Backend: `feature/backend-issue-B12-asignaciones-horarios`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(admin): vincular guardias con horarios B12`

## Borrador del Pull Request

### Título

`feat(backend): asignar guardias a horarios de servicios`

### Referencia de cierre

`Fixes backend#B12`

### Resumen

Se extiende el backend B11 con la tabla puente `guardia_horarios` y la API protegida para listar, asignar y desasignar guardias de horarios. La operación valida el rol guardia, evita duplicados, respeta los días bloqueados y rechaza sobrecupos.

### Checklist

- [ ] Se crea la tabla `guardia_horarios` con unicidad por usuario y horario.
- [ ] `GET/POST/DELETE /api/admin/horarios/:id/guardias` requieren autenticación y rol de administrador.
- [ ] Solo se asignan usuarios con rol `guardia`.
- [ ] Duplicados responden 409 y los sobrecupos responden 409.
- [ ] Los días bloqueados del guardia responden 409 y no crean la asignación.
- [ ] No se tocaron rutas de `front/`.
- [ ] La raíz de `v12-issue-B12` contiene únicamente `west-security-backend/`.
