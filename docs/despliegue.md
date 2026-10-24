# Demo de portafolio y Docker

Consulta de planes: 24 de octubre de 2026. Son opciones para una demo; no equivalen a disponibilidad garantizada ni recursos ilimitados. No se ha contratado ni desplegado ningún servicio.

## Recomendación

Publicar primero código, capturas y pruebas en GitHub. Después, si se desea una demo navegable, usar un servicio Node para Express + React compilado, MongoDB Atlas y Cloudinary. Servir frontend, API y Socket.IO en el mismo origen conserva el diseño de cookies actual y evita cambiar la arquitectura solo para alojarla.

| Servicio                                                                                    | Encaje                                                          | Límites relevantes                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Render Free](https://render.com/docs/free)                                                 | Primera opción para un Web Service Node o Docker                | Suspensión tras 15 minutos sin tráfico; 750 horas gratuitas por workspace al mes; límites de transferencia y compilación. Sin método de pago, el exceso de transferencia suspende servicios. Con método de pago pueden existir cargos adicionales: revisar límites de gasto. |
| [Koyeb Free Instance](https://www.koyeb.com/docs/reference/instances)                       | Alternativa para el servidor                                    | Una instancia gratuita por organización, 512 MB, 0,1 vCPU; escala a cero tras una hora sin tráfico.                                                                                                                                                                          |
| [MongoDB Atlas Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) | Base con replica set compatible con los matches transaccionales | Un clúster Free por proyecto; límites de almacenamiento, conexiones y operación.                                                                                                                                                                                             |
| [Cloudinary Free](https://cloudinary.com/pricing)                                           | Fotos sin depender del disco efímero del servidor               | 25 créditos mensuales compartidos entre recursos; revisar consumo y retención.                                                                                                                                                                                               |

Render/Koyeb son alternativas entre sí; Atlas y Cloudinary cubren servicios distintos. No separar el frontend en otro proveedor es una decisión de simplicidad para este proyecto, no una exigencia de MERN. Una demo que despierta lentamente debe indicarlo junto al enlace del README.

## Render sin Docker

Crear un Web Service conectado al repositorio y seleccionar explícitamente el plan Free. Configuración orientativa:

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

No se incluye MongoDB standalone en Compose: rompería las transacciones existentes. Tampoco hace falta Kubernetes para este proyecto.

**Estado de validación:** La imagen requiere validación mediante `docker build` y una prueba de ejecución con las variables del entorno de destino. El workflow incluye una compilación Docker en GitHub Actions; hasta que ese job pase, la imagen debe considerarse pendiente de verificación. Los tests fullstack existentes verifican la aplicación con Node y MongoDB temporal, no el contenedor.

## Repositorio

[PoliMatch EPN en GitHub](https://github.com/ErickEduardoEspinozaTipantiza/PoliMatch-EPN).

Mantener las credenciales en variables de entorno del proveedor. Nunca incluir archivos `.env`, bases de datos reales ni contraseñas de usuarios en el repositorio. Las capturas utilizan exclusivamente datos ficticios.
