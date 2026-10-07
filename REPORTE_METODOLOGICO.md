# Reporte metodológico - Backend Issue B11

## Estrategia de ramas

- Backend: `feature/backend-issue-B11-horarios-servicios`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(admin): agregar CRUD de horarios por servicio B11`

## Borrador del Pull Request

### Título

`feat(backend): gestionar horarios asociados a servicios`

### Referencia de cierre

`Fixes backend#B11`

### Resumen

Se extiende el backend B10 con la tabla `horarios`, relacionada mediante `servicio_id` con los servicios gestionados por la tabla `locales`, más la API protegida `GET/POST/PUT/DELETE /api/admin/horarios`. La operación permite filtrar por `servicio_id`, exige que el servicio exista y valida que `hora_fin` sea estrictamente posterior a `hora_inicio`.

### Checklist

- [ ] Se crea la tabla `horarios` con `servicio_id`, días, horas y capacidad, relacionada con los servicios de B10.
- [ ] `GET/POST/PUT/DELETE /api/admin/horarios` requieren autenticación y rol de administrador.
- [ ] `GET /api/admin/horarios?servicio_id=:id` filtra los horarios por servicio.
- [ ] Un servicio inexistente responde 422 y no crea ni actualiza horarios.
- [ ] Una hora de fin igual o anterior a la hora de inicio responde 422.
- [ ] No se tocaron rutas de `front/`.
- [ ] La raíz de `v11-issue-B11` contiene únicamente `west-security-backend/`.
