import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect, peerId } from "../e2e/fixtures.js";

// These are captures of the real UI with an isolated API, not product mockups.
// Illustrated profiles deliberately avoid real people and third-party photos.
function portrait(background, shirt, hair) {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="${background}"/><circle cx="500" cy="90" r="180" fill="#ffffff30"/><path d="M60 800V610a260 260 0 01520 0v190" fill="${shirt}"/><ellipse cx="320" cy="288" rx="122" ry="153" fill="${hair}"/><ellipse cx="320" cy="320" rx="94" ry="122" fill="#bc8c71"/><path d="M216 290q-10-165 125-151q117 0 108 161q-83-17-131-94q-30 61-102 84" fill="${hair}"/><path d="M293 371q27 15 54 0" stroke="#714b42" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
    )
  );
}

test("capturas de portafolio con datos ficticios", async ({
  page,
  fixtureApi,
}) => {
  const folder = resolve("docs/screenshots");
  await mkdir(folder, { recursive: true });
  const lucia = {
    ...fixtureApi.matches[0],
    name: "Lucía Demo",
    image: portrait("#c6ddd5", "#233e52", "#45332d"),
  };
  const sara = {
    ...fixtureApi.profiles[1],
    name: "Sara Demo",
    image: portrait("#ead8c8", "#914d60", "#3b302b"),
    city: "Quito",
    university: "Escuela Politécnica Nacional",
    relationshipGoal: "open-to-explore",
    interests: ["Café", "Música", "Senderismo"],
    bio: "Un café después de clases, música en vivo y planes que no estaban en el calendario.",
  };
  fixtureApi.user = {
    ...fixtureApi.user,
    name: "Alex Demo",
    image: portrait("#d5dbe5", "#40675e", "#322c2c"),
    interests: ["Cine", "Tecnología", "Viajes"],
    relationshipGoal: "friendship",
    city: "Quito",
    university: "Escuela Politécnica Nacional",
    bio: "Siempre hay tiempo para una buena conversación después de clases.",
  };
  fixtureApi.user.photos = [fixtureApi.user.image];
  fixtureApi.matches = [lucia];
  fixtureApi.profiles = [sara];
  fixtureApi.messages = [
    {
      _id: "000000000000000000000010",
      sender: peerId,
      receiver: fixtureApi.user._id,
      content:
        "¡Hola, Alex! Vi que también te gusta el cine. ¿Alguna recomendación?",
      createdAt: "2026-10-24T15:00:00Z",
    },
    {
      _id: "000000000000000000000011",
      sender: fixtureApi.user._id,
      receiver: peerId,
      content:
        "¡Hola! Tengo varias. ¿Te gustan más los thrillers o la ciencia ficción?",
      createdAt: "2026-10-24T15:01:00Z",
    },
    {
      _id: "000000000000000000000012",
      sender: peerId,
      receiver: fixtureApi.user._id,
      content:
        "Ciencia ficción, sin duda. Podemos intercambiar una lista después de clases ☕",
      createdAt: "2026-10-24T15:02:00Z",
    },
  ];
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: resolve(folder, name + ".png"),
      animations: "disabled",
      fullPage: false,
    });
  };
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Me gusta Sara Demo" }),
  ).toBeVisible();
  await capture("discover-desktop");
  await page.goto("/connections");
  await expect(
    page.getByRole("link", { name: /Lucía Demo.*Empiecen/ }),
  ).toBeVisible();
  await capture("connections-desktop");
  await page.goto(`/chat/${peerId}`);
  await expect(page.getByText(/Ciencia ficción, sin duda/)).toBeVisible();
  await capture("chat-desktop");
  await page.goto("/profile");
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Alex Demo",
  );
  await capture("profile-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Me gusta Sara Demo" }),
  ).toBeVisible();
  await capture("discover-mobile");
  await page.route("**/api/matches/swipe-right/*", (route) =>
    route.fulfill({ json: { success: true, match: sara } }),
  );
  await page.getByRole("button", { name: "Me gusta Sara Demo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture("match-mobile");
  fixtureApi.authenticated = false;
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Empecemos por ti." }),
  ).toBeVisible();
  await capture("onboarding-desktop");
});
