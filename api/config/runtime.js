export function validateEnvironment(env) {
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI || ""))
    throw new Error("Configura MONGO_URI con una conexión MongoDB válida.");
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 32)
    throw new Error(
      "Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
    );
  let url;
  try {
    url = new URL(env.CLIENT_URL);
  } catch {
    throw new Error("Configura CLIENT_URL con el origen del navegador.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== env.CLIENT_URL ||
    url.username ||
    url.password
  )
    throw new Error(
      "CLIENT_URL debe ser un origen HTTP(S), sin ruta ni credenciales.",
    );
  const port = env.PORT === undefined ? 5000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("PORT no es válido.");
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5)
    throw new Error(
      "TRUST_PROXY debe indicar entre 0 y 5 proxies de confianza.",
    );
  return {
    jwtSecret: env.JWT_SECRET,
    clientUrl: url.origin,
    production: env.NODE_ENV === "production",
    port,
    trustProxy,
  };
}
