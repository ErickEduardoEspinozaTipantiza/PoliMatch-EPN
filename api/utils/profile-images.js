import { ApiError } from "./errors.js";

export async function uploadProfileImage(image, uploadImage) {
  const match =
    typeof image === "string" &&
    /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      image,
    );
  if (!match)
    throw new ApiError(400, "Selecciona una imagen PNG, JPEG, WebP o GIF.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 2 * 1024 * 1024)
    throw new ApiError(
      413,
      "La foto debe pesar como máximo 2 MB.",
      "PAYLOAD_TOO_LARGE",
    );
  const valid =
    match[1] === "png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ["jpeg", "jpg"].includes(match[1])
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : match[1] === "gif"
          ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
          : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid)
    throw new ApiError(400, "El archivo no contiene una imagen válida.");
  try {
    return await uploadImage(image);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "No pudimos subir la foto. Puedes volver a intentarlo.",
      "UPLOAD_FAILED",
    );
  }
}
