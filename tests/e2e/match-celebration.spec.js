import AxeBuilder from "@axe-core/playwright";
import { test, expect, peerProfile } from "./fixtures.js";

test("un match confirmado celebra las dos personas y abre su conversación", async ({
  page,
  fixtureApi,
}, testInfo) => {
  void fixtureApi;
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/api/matches/swipe-right/*", (route) =>
    route.fulfill({ json: { success: true, match: peerProfile } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Me gusta Lucía Prueba", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Es mutuo." }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("match-fictional-fixtures.png"),
    animations: "disabled",
  });
  await dialog.getByRole("link", { name: "Empezar a conversar" }).click();
  await expect(page).toHaveURL(`/chat/${peerProfile._id}`);
  await expect(dialog).toHaveCount(0);
});

test("la celebración permite continuar con Escape y respeta movimiento reducido", async ({
  page,
  fixtureApi,
}) => {
  void fixtureApi;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/matches/swipe-right/*", (route) =>
    route.fulfill({ json: { success: true, match: peerProfile } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Me gusta Lucía Prueba", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .locator(".match-portrait-own")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Me gusta Dani Ensayo", exact: true }),
  ).toBeEnabled();
});
