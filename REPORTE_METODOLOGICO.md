# Reporte metodológico - Backend Issue B01

## Estrategia de ramas

- Backend: `feature/backend-issue-B01-init`
- Frontend: no aplica en esta Issue. El frontend se trabajará como servicio independiente cuando corresponda.

## Registro de commits sugeridos

- `feat(server): inicializar API B01 con health, entorno y CORS`

## Borrador del Pull Request

### Título

`feat(backend): inicializar servidor API`

### Referencia de cierre

`Fixes backend#B01`

### Resumen

Se agrega un servidor Node.js/Express ejecutable con puerto, versión y origen CORS configurables mediante variables de entorno. También se incorpora `GET /api/health`, que devuelve el estado `ok` y la versión de la API.

### Checklist

- [ ] `npm install` completa la instalación.
- [ ] `npm run dev` inicia el servidor en modo desarrollo.
- [ ] `npm start` inicia el servidor.
- [ ] `GET /api/health` devuelve estado y versión.
- [ ] CORS utiliza `CORS_ORIGIN`.
- [ ] No se agregaron bases de datos, tablas ni modelos.
- [ ] La raíz de `v01-issue-B01` contiene únicamente `west-security-backend/`.
