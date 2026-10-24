export class ApiError extends Error {
  constructor(status, message, code = "REQUEST_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function errorHandler(error, _req, res, _next) {
  let status = error.status || 500;
  let message =
    error instanceof ApiError
      ? error.message
      : "No pudimos completar la solicitud.";
  let code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
  if (error.type === "entity.too.large") {
    status = 413;
    message = "La imagen supera el tamaño permitido.";
    code = "PAYLOAD_TOO_LARGE";
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    message = "El cuerpo JSON no es válido.";
    code = "INVALID_JSON";
  } else if (error.code === 11000) {
    status = 409;
    message = "Ya existe una cuenta con ese correo.";
    code = "EMAIL_EXISTS";
  } else if (["ValidationError", "CastError"].includes(error.name)) {
    status = 400;
    message = "Revisa los datos enviados.";
    code = "INVALID_INPUT";
  } else if (
    ["MongoServerSelectionError", "MongooseServerSelectionError"].includes(
      error.name,
    )
  ) {
    status = 503;
    message = "El servicio no está disponible temporalmente.";
    code = "SERVICE_UNAVAILABLE";
  }
  res.status(status).json({ success: false, message, code });
}
