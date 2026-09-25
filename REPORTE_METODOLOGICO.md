# Reporte metodológico - Backend Issue B06

## Estrategia de ramas

- Backend: `feature/backend-issue-B06-me-logout`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(auth): agregar usuario actual y logout idempotente B06`

## Borrador del Pull Request

### Título

`feat(backend): consultar sesión actual y cerrar sesión`

### Referencia de cierre

`Fixes backend#B06`

### Resumen

Se extiende el backend B05 con `GET /api/me` y `POST /api/logout`. El perfil devuelve únicamente id, username y rol; logout destruye la sesión y limpia la cookie de forma idempotente.

### Checklist

- [ ] `GET /api/me` devuelve el perfil de la sesión actual sin datos sensibles.
- [ ] `/api/me` responde 401 sin sesión o con usuario inexistente/bloqueado.
- [ ] `POST /api/logout` destruye la sesión y limpia la cookie.
- [ ] Logout repetido es idempotente.
- [ ] No se agregaron rutas de negocio ni cambios en `front/`.
- [ ] La raíz de `v06-issue-B06` contiene únicamente `west-security-backend/`.
