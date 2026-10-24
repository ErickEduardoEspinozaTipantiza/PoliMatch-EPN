import { test, expect, peerId } from "./fixtures.js";

test("respuesta inmediata conserva la tarjeta durante su salida y bloquea duplicados", async ({
  page,
  fixtureApi,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
  const sample = await page.evaluate(async () => {
    const card = [...document.querySelectorAll(".swipe-card-wrapper")].at(-1);
    const button = document.querySelector(".swipe-button");
    button.click();
    button.click();
    const flight = card.getAnimations()[0];
    await flight.ready;
    while (flight.currentTime < 90 && card.isConnected)
      await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      attached: card.isConnected,
      x: new DOMMatrix(getComputedStyle(card).transform).m41,
      phase: document.querySelector(".swipe-stack").dataset.phase,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      animations: card
        .getAnimations()
        .map((a) => ({
          time: a.currentTime,
          state: a.playState,
          duration: a.effect.getTiming().duration,
        })),
    };
  });

  expect(sample.attached).toBe(true);
  expect(sample.x).toBeLessThan(-10);
  await expect(
    page.getByRole("button", { name: /pasar a Dani/i }),
  ).toBeEnabled();
  expect(
    fixtureApi.requests.filter((r) => r.path.includes("/swipe-")),
  ).toHaveLength(1);
});

test("arrastre corto regresa sin elegir; arrastre horizontal confirma una sola elección", async ({
  page,
  fixtureApi,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const card = page.locator(".swipe-card-wrapper").last();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(() =>
      card.evaluate((el) =>
        Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41),
      ),
    )
    .toBeLessThan(1);
  expect(
    fixtureApi.requests.filter((r) => r.path.includes("/swipe-")),
  ).toHaveLength(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 5, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: /pasar a Dani/i }),
  ).toBeEnabled();
  expect(fixtureApi.requests.filter((r) => r.path.includes("/swipe-"))).toEqual(
    [expect.objectContaining({ path: `/matches/swipe-right/${peerId}` })],
  );
});

test("rechazo devuelve el mismo perfil y permite reintentar con teclado", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.swipeFailures = 1;
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const button = page.getByRole("button", { name: /pasar a Lucía/i });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("No se pudo guardar tu elección ficticia."),
  ).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: /Lucía Prueba/, level: 2 }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /pasar a Dani/i }),
  ).toBeEnabled();
});

test("último perfil termina su salida antes del estado vacío", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.profiles = fixtureApi.profiles.slice(0, 1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
  const retained = await page.evaluate(async () => {
    const card = document.querySelector(".swipe-card-wrapper");
    document.querySelector(".swipe-button").click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return card.isConnected;
  });
  expect(retained).toBe(true);
  await expect(
    page.getByRole("heading", { name: /viste.*perfiles|sin.*perfiles/i }),
  ).toBeVisible();
});

test("movimiento reducido deja quieto un arrastre real incompleto", async ({
  page,
  fixtureApi,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.locator(".swipe-card-wrapper").last();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y, { steps: 6 });
  await page.mouse.up();
  const running = await card.evaluate(async (el) => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    return {
      x: new DOMMatrix(getComputedStyle(el).transform).m41,
      animations: el.getAnimations().length,
    };
  });
  expect(running).toEqual({ x: 0, animations: 0 });
  expect(
    fixtureApi.requests.filter((r) => r.path.includes("/swipe-")),
  ).toHaveLength(0);
});
