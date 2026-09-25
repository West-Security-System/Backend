# Reporte metodológico - Backend Issue B07

## Estrategia de ramas

- Backend: `feature/backend-issue-B07-auth-middlewares`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(auth): agregar middlewares de autenticación y autorización B07`

## Borrador del Pull Request

### Título

`feat(backend): proteger rutas con auth y admin middleware`

### Referencia de cierre

`Fixes backend#B07`

### Resumen

Se extiende el backend B06 con dos middlewares de control de acceso: `requiereAuth` valida la sesión activa y `requiereAdmin` exige rol `admin`. Se restringe el origen CORS al cliente autorizado y se documenta la validación de permisos para rutas administrativas.

### Checklist

- [ ] `requiereAuth` responde 401 si no hay sesión válida o el usuario está bloqueado.
- [ ] `requiereAdmin` responde 403 cuando el rol no es `admin`.
- [ ] La política de CORS solo acepta el origen autorizado configurado en `CORS_ORIGIN`.
- [ ] `GET /api/me` sigue respondiendo con el perfil autenticado.
- [ ] `GET /api/admin/dashboard` exige autenticación y permisos de administrador.
- [ ] No se tocaron rutas de `front/`.
- [ ] La raíz de `v07-issue-B07` contiene únicamente `west-security-backend/`.
