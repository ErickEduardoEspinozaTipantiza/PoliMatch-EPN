# Capturas del portafolio

Estas siete imágenes son capturas del frontend real de PoliMatch. Se generan con Playwright y una API interceptada que usa únicamente nombres, mensajes y perfiles ficticios. Los retratos son SVG creados en el script, no fotografías de personas reales ni imágenes generadas que simulen pantallas del producto.

```sh
npm ci
npm ci --prefix client
npx playwright install chromium
npm run screenshots
```

En Windows se utiliza Edge si ya está instalado. El script arranca Vite en el puerto 5178, bloquea tráfico externo y no inicia Express, Atlas ni Cloudinary. Requiere que ese puerto esté libre. Sobrescribe solo las capturas de esta carpeta con una nueva ejecución.

Fuente: `tests/portfolio/screenshots.spec.js`. Configuración: `playwright.portfolio.config.js`. Resoluciones: escritorio 1440 × 960, móvil 390 × 844.

Las capturas documentan apariencia y flujos visibles. La comprobación del backend, la persistencia y el chat real se realiza en las suites de API y fullstack, no se deduce de estas imágenes.
