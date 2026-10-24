import mongoose from "mongoose";
import User from "../models/User.js";

export function validateSeedEnvironment(env) {
  if (env.NODE_ENV === "production")
    throw new Error("El seed está desactivado en producción.");
  if (env.SEED_CONFIRM !== "polimatch-local-demo")
    throw new Error(
      "Confirma los datos ficticios con SEED_CONFIRM=polimatch-local-demo.",
    );
  let uri;
  try {
    uri = new URL(env.SEED_URI);
  } catch {
    throw new Error("Configura SEED_URI con una base local desechable.");
  }
  if (
    uri.protocol !== "mongodb:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname) ||
    uri.username ||
    uri.password ||
    uri.hash ||
    !/^\/polimatch_(?:seed|test)(?:[_-][a-z\d_-]+)?$/i.test(uri.pathname)
  ) {
    throw new Error(
      "SEED_URI solo admite MongoDB local, sin credenciales, en una base polimatch_seed o polimatch_test.",
    );
  }
  const allowedOptions = new Set([
    "replicaSet",
    "directConnection",
    "serverSelectionTimeoutMS",
  ]);
  for (const key of uri.searchParams.keys()) {
    if (!allowedOptions.has(key))
      throw new Error("SEED_URI contiene opciones no permitidas.");
  }
  return env.SEED_URI;
}

const names = {
  male: [
    "Diego",
    "Carlos",
    "Miguel",
    "Andrés",
    "Luis",
    "Jorge",
    "Daniel",
    "Gabriel",
    "Eduardo",
  ],
  female: [
    "Ana",
    "María",
    "Valeria",
    "Sofía",
    "Daniela",
    "Laura",
    "Isabella",
    "Carolina",
    "Camila",
    "Victoria",
    "Paula",
    "Andrea",
  ],
};

// MONGO_URI and .env are deliberately ignored. Existing accounts, including
// locally edited demos, are preserved. User.create runs the password hook once.
export async function seedUsers({
  env = process.env,
  connectDatabase = (uri) => mongoose.connect(uri),
  disconnectDatabase = () => mongoose.disconnect(),
} = {}) {
  const uri = validateSeedEnvironment(env);
  let created = 0;
  try {
    await connectDatabase(uri);
    for (const [gender, people] of Object.entries(names)) {
      for (const [index, name] of people.entries()) {
        const email = `demo.${gender}.${index + 1}@example.invalid`;
        if (await User.exists({ email })) continue;
        await User.create({
          name,
          email,
          password: "local-demo-password",
          age: 21 + index,
          gender,
          genderPreference: "both",
          bio: "Perfil ficticio para probar PoliMatch en tu equipo.",
          image: `/${gender}/${index + 1}.svg`,
        });
        created++;
      }
    }
    return { created };
  } finally {
    await disconnectDatabase();
  }
}
