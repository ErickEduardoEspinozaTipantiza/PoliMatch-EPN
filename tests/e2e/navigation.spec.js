import { test, expect } from "./fixtures.js";

test("Conexiones abre una vista propia y permite volver a Descubrir", async ({
  page,
  fixtureApi,
}) => {
  void fixtureApi;
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Descubrir personas" }),
  ).toBeVisible();
  const nav = page.locator("nav:visible");
  await nav.getByRole("link", { name: "Conexiones", exact: true }).click();
  await expect(page).toHaveURL("/connections");
  await expect(
    nav.getByRole("link", { name: "Conexiones", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("region", { name: "Descubrir personas" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: /Lucía Prueba.*Empiecen a conversar/ })
    .click();
  await expect(page).toHaveURL(/\/chat\//);
  await nav.getByRole("link", { name: "Descubrir", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("region", { name: "Descubrir personas" }),
  ).toBeVisible();
});

test("Conexiones tiene acceso directo y el enlace antiguo redirige sin cargar descubrimiento", async ({
  page,
  fixtureApi,
}) => {
  await page.goto("/#conexiones");
  await expect(page).toHaveURL("/connections");
  await expect(
    page.getByRole("heading", { name: "Tus conexiones", exact: true }),
  ).toBeVisible();
  expect(
    fixtureApi.requests.some(
      (request) => request.path === "/matches/user-profiles",
    ),
  ).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Lucía Prueba.*Empiecen a conversar/ }),
  ).toBeVisible();
});
