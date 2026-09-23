# Reporte metodológico - Backend Issue B04

## Estrategia de ramas

- Backend: `feature/backend-issue-B04-users-model`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(database): agregar modelo de usuarios y hash seguro B04`

## Borrador del Pull Request

### Título

`feat(backend): agregar usuarios y roles restringidos`

### Referencia de cierre

`Fixes backend#B02`

### Resumen

Se extiende el backend B03 con la migración y servicio de usuarios: username único, roles restringidos, bloqueo, timestamps y passwords procesadas con bcrypt. No se agregan endpoints de login ni sesiones.

### Checklist

- [ ] `usuarios` incluye id, username único, password_hash, rol, bloqueado y timestamps.
- [ ] La base restringe los roles a `admin` y `guardia`.
- [ ] El servicio rechaza usernames duplicados y roles no autorizados.
- [ ] Las contraseñas se almacenan con bcrypt y nunca se devuelven.
- [ ] No se agregaron endpoints de login ni controladores de sesión.
- [ ] La raíz de `v04-issue-B04` contiene únicamente `west-security-backend/`.
