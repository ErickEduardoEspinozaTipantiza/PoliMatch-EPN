import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedUsers } from "./demo.js";

export { seedUsers, validateSeedEnvironment } from "./demo.js";

const isEntry =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  seedUsers()
    .then(({ created }) => {
      console.log(
        `Datos ficticios locales: ${created} perfiles creados. Se conservaron los perfiles existentes.`,
      );
    })
    .catch(() => {
      console.error(
        "No se generaron los datos ficticios. Verifica SEED_URI (MongoDB local, base polimatch_seed o polimatch_test) y SEED_CONFIRM=polimatch-local-demo. El seed está desactivado en producción.",
      );
      process.exitCode = 1;
    });
}
