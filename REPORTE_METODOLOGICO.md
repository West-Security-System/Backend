# Reporte metodológico - Backend Issue B03

## Estrategia de ramas

- Backend: `feature/backend-issue-B03-sqlite-migrations`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commit sugerido

- `feat(database): agregar SQLite y migraciones idempotentes B03`

## Borrador del Pull Request

### Título

`feat(backend): agregar persistencia SQLite inicial`

### Referencia de cierre

`Fixes backend#B02`

### Resumen

Se extiende el backend B02 con persistencia SQLite en `data/west_control.db`, claves foráneas activadas, migraciones idempotentes y arranque bloqueado ante fallos de persistencia.

### Checklist

- [ ] Se crea o carga `data/west_control.db`.
- [ ] Las claves foráneas están activadas.
- [ ] Las migraciones pueden ejecutarse varias veces sin duplicar tablas ni datos base.
- [ ] Un fallo de persistencia detiene el servidor con un mensaje limpio.
- [ ] No se agregaron endpoints de usuarios ni autenticación.
- [ ] La raíz de `v03-issue-B03` contiene únicamente `west-security-backend/`.
