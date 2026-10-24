export function errorMessage(
  error,
  fallback = "No pudimos completar la solicitud. Inténtalo de nuevo.",
) {
  if (!error?.response)
    return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
  return typeof error.response.data?.message === "string"
    ? error.response.data.message
    : fallback;
}
