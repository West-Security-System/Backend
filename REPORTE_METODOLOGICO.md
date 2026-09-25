# Reporte metodológico - Backend Issue B08

## Estrategia de ramas

- Backend: `feature/backend-issue-B08-admin-usuarios`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(admin): agregar CRUD protegido de usuarios B08`

## Borrador del Pull Request

### Título

`feat(backend): administrar usuarios con validación y control de permisos`

### Referencia de cierre

`Fixes backend#B08`

### Resumen

Se extiende el backend B07 con rutas administrativas protegidas para consultar, crear, actualizar y eliminar usuarios. Las operaciones validan campos obligatorios, encripta contraseñas con bcrypt, rechazan usernames duplicados con 409, impiden la autoeliminación del administrador activo y ocultan los hashes de contraseña en todas las respuestas JSON.

### Checklist

- [ ] `GET /api/admin/usuarios` devuelve la lista sin incluir hashes.
- [ ] `POST /api/admin/usuarios` valida campos obligatorios, rol permitido y guarda un hash bcrypt.
- [ ] `POST /api/admin/usuarios` responde 409 ante username duplicado.
- [ ] `PUT /api/admin/usuarios` valida cambios y evita duplicates.
- [ ] `DELETE /api/admin/usuarios` prohíbe eliminar al administrador autenticado actual.
- [ ] Todas las respuestas JSON sanitizan el campo `password_hash`.
- [ ] No se tocaron rutas de `front/`.
- [ ] La raíz de `v08-issue-B08` contiene únicamente `west-security-backend/`.
