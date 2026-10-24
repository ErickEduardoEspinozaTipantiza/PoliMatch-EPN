import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "../utils/errors.js";

// Read deployment configuration only when uploading; imports never load .env.
export async function uploadImage(image) {
  const {
    CLOUDINARY_CLOUD_NAME: cloud_name,
    CLOUDINARY_API_KEY: api_key,
    CLOUDINARY_API_SECRET: api_secret,
  } = process.env;
  if (!cloud_name || !api_key || !api_secret)
    throw new ApiError(
      503,
      "Las fotos no están disponibles temporalmente.",
      "UPLOAD_UNAVAILABLE",
    );
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  const result = await cloudinary.uploader.upload(image, {
    folder: "polimatch/profiles",
    resource_type: "image",
  });
  return result.secure_url;
}
export default cloudinary;
