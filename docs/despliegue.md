# Despliegue y Docker

PoliMatch sirve el frontend compilado, la API y Socket.IO desde un mismo proceso Node. Requiere MongoDB con replica set, Cloudinary para las fotografías y HTTPS en producción.

## Servicio Node

- Build: `npm ci && npm ci --prefix client && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Runtime: Node 24.

Variables del servicio: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` con el origen HTTPS exacto asignado y las tres variables `CLOUDINARY_*` de `.env.example`. El proveedor puede asignar `PORT`. Configurar `TRUST_PROXY` según el número real de proxies y verificar `req.ip` antes de abrir el registro; no copiar un valor genérico sin comprobar la topología.

Preparar los índices y permisos de la base con un procedimiento autorizado. Probar registro, doble sesión, match, chat/socket, logout, recarga y subida real de foto. El contenedor y el proceso Node no resuelven por sí solos configuración de red, índices, credenciales ni moderación.

## Docker opcional

El `Dockerfile` compila React en una etapa y ejecuta Express con Node 24 en otra. La imagen final usa un usuario sin privilegios, instala solo dependencias de producción, incluye un health check y recibe credenciales exclusivamente en ejecución. `.dockerignore` excluye entorno, Git, node_modules y artefactos.

```sh
docker build -t polimatch:local .
docker run --rm --name polimatch -p 127.0.0.1:5000:5000 --env-file .env.docker.local polimatch:local
```

Crear `.env.docker.local` localmente a partir de los nombres de `.env.example`, con `PORT=5000`, `CLIENT_URL` correspondiente al navegador y MongoDB accesible desde el contenedor. No reutilizar una URI `localhost` que pretendía apuntar al host: dentro del contenedor apunta al propio contenedor. En Docker Desktop puede usarse `host.docker.internal` para una réplica local configurada; Atlas sigue requiriendo sus permisos de red.

La imagen sirve el frontend compilado en modo producción. Las cookies son Secure: usar HTTPS para el despliegue; para probar autenticación sobre HTTP local, usar el flujo de desarrollo documentado en el README. No cambiar a `NODE_ENV=development` en este contenedor para resolverlo, porque Express dejaría de servir `client/dist`.

MongoDB debe ejecutarse como replica set para soportar las transacciones del matching.

**Estado de validación:** la compilación Docker pasó en [GitHub Actions](https://github.com/ErickEduardoEspinozaTipantiza/PoliMatch-EPN/actions/runs/40107160409). Falta ejecutar el contenedor con MongoDB, HTTPS y las variables del entorno de destino. Las pruebas fullstack verifican la aplicación con Node y MongoDB temporal; no sustituyen esa prueba de ejecución del contenedor.

## Repositorio

[PoliMatch EPN en GitHub](https://github.com/ErickEduardoEspinozaTipantiza/PoliMatch-EPN).

Mantener las credenciales en variables de entorno del proveedor. Nunca incluir archivos `.env`, bases de datos reales ni contraseñas de usuarios en el repositorio. Las capturas utilizan exclusivamente datos ficticios.
