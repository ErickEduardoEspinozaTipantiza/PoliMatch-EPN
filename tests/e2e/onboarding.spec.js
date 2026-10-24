import { test, expect, expectNoHorizontalOverflow } from "./fixtures.js";

test("registro por pasos conserva datos al volver y limita intereses", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.authenticated = false;
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Paso 1 de 5")).toBeVisible();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Alex");
  await page.getByLabel("Edad", { exact: true }).fill("23");
  await page.getByLabel("Correo electrónico").fill("alex@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("Secret123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Hombre", { exact: true }).check();
  await page.getByLabel("Ambos", { exact: true }).check();
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await expect(page.getByLabel("Tu nombre", { exact: true })).toHaveValue(
    "Alex",
  );
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByLabel("Ambos", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Una conexión a tu medida." }),
  ).toBeVisible();
  const interests = page
    .getByRole("group", { name: /Tus intereses/ })
    .getByRole("button");
  for (let i = 0; i < 5; i++) await interests.nth(i).click();
  await expect(interests.nth(5)).toBeDisabled();
  await interests.nth(0).click();
  await expect(interests.nth(5)).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("galería conserva el borrador y confirma subida, portada y eliminación", async ({
  page,
  fixtureApi,
}) => {
  await page.goto("/profile");
  await page.getByLabel("Biografía").fill("Borrador sin guardar");
  const file = {
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  fixtureApi.photoFailures = 1;
  await page.getByLabel("Añadir foto a la galería").setInputFiles(file);
  await expect(page.getByRole("alert")).toHaveText(
    "No se pudo subir la foto ficticia.",
  );
  await expect(page.getByLabel("Biografía")).toHaveValue(
    "Borrador sin guardar",
  );
  await page.getByLabel("Añadir foto a la galería").setInputFiles(file);
  await expect(page.getByAltText("Foto 2 de tu perfil")).toBeVisible();
  await page.getByRole("button", { name: "Hacer portada la foto 2" }).click();
  await expect(page.getByAltText("Foto 1 de tu perfil")).toHaveAttribute(
    "src",
    "http://127.0.0.1:5178/qa-uploaded-avatar.svg",
  );
  await expect(page.getByLabel("Biografía")).toHaveValue(
    "Borrador sin guardar",
  );
  await page.getByRole("button", { name: "Eliminar foto 2" }).click();
  await expect(page.getByAltText("Foto 2 de tu perfil")).toHaveCount(0);
  await page.reload();
  await expect(page.getByAltText("Foto 1 de tu perfil")).toHaveAttribute(
    "src",
    "http://127.0.0.1:5178/qa-uploaded-avatar.svg",
  );
  await expectNoHorizontalOverflow(page);
});
