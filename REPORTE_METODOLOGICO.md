# Reporte metodológico - Backend Issue B10

## Estrategia de ramas

- Backend: `feature/backend-issue-B10-locales-admin`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(admin): agregar CRUD de locales B10`

## Borrador del Pull Request

### Título

`feat(backend): gestionar servicios con validación y política de eliminación`

### Referencia de cierre

`Fixes backend#B10`

### Resumen

Se extiende el backend B09 con la tabla `locales` y la API protegida `GET/POST/PUT/DELETE /api/admin/locales`. La operación valida latitud y longitud dentro de rangos válidos, rechaza nombres duplicados con 409, y protege la eliminación de locales que todavía tienen relaciones activas con guardias.

### Checklist

- [ ] Se crea la tabla `locales` con `nombre`, `latitud` y `longitud`.
- [ ] `GET/POST/PUT/DELETE /api/admin/locales` requieren autenticación y rol de administrador.
- [ ] Latitud y longitud deben estar dentro de rangos numéricos válidos y responder 422 si no lo están.
- [ ] Nombres duplicados responden 409 Conflict.
- [ ] La eliminación de local con relaciones activas responde 409 y no destruye registros vinculados.
- [ ] No se tocaron rutas de `front/`.
- [ ] La raíz de `v10-issue-B10` contiene únicamente `west-security-backend/`.
