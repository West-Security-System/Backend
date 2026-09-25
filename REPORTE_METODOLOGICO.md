# Reporte metodológico - Backend Issue B05

## Estrategia de ramas

- Backend: `feature/backend-issue-B05-login-session`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(auth): implementar login y sesión HttpOnly B05`

## Borrador del Pull Request

### Título

`feat(backend): autenticar usuarios con sesión segura`

### Referencia de cierre

`Fixes backend#B05`

### Resumen

Se extiende el backend B04 con `POST /api/login`, comparación bcrypt y cookie de sesión HttpOnly con `SameSite=Lax`, expiración configurable y seguridad configurable para desarrollo/producción.

### Checklist

- [ ] `POST /api/login` valida username y password con bcrypt.
- [ ] Credenciales inválidas responden 401 genérico.
- [ ] La cookie es HttpOnly, SameSite=Lax y tiene expiración configurable.
- [ ] La respuesta no devuelve password ni password_hash.
- [ ] No se agregaron logout ni middlewares de protección de rutas.
- [ ] La raíz de `v05-issue-B05` contiene únicamente `west-security-backend/`.
