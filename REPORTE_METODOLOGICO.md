# Reporte metodológico - Backend Issue B02

## Estrategia de ramas

- Backend: `feature/backend-issue-B02-contract-errors`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(server): unificar respuestas y manejo global de errores B02`

## Borrador del Pull Request

### Título

`feat(backend): establecer contrato de respuestas y errores`

### Referencia de cierre

`Fixes backend#B02`

### Resumen

Se extiende el backend B01 con un formato JSON único para respuestas exitosas y errores, middleware global para códigos HTTP estándar y ocultamiento de stack traces fuera de desarrollo.

### Checklist

- [ ] Las respuestas exitosas usan `{ data, error: null }`.
- [ ] Los errores usan `{ data: null, error }`.
- [ ] El middleware contempla 400, 401, 403, 404, 409, 422 y 500.
- [ ] Los campos inválidos pueden informarse en `error.fields`.
- [ ] El stack trace solo aparece con `NODE_ENV=development`.
- [ ] No se agregaron autenticación, bases de datos, tablas ni modelos.
- [ ] La raíz de `v02-issue-B02` contiene únicamente `west-security-backend/`.
