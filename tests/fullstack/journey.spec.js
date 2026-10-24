import { test, expect } from "@playwright/test";

const password = "Ficticia-Integral-2026";
async function signup(page, { name, email, gender }) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Edad", { exact: true }).fill("25");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator(`input[name=gender][value=${gender}]`).check();
  await page.getByRole("radio", { name: "Ambos", exact: true }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/signup") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  expect((await response).status()).toBe(201);
  await page
    .getByRole("link", { name: /Añadir fotos más tarde|Empezar a descubrir/ })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
}

test("two real sessions edit profiles, mutually match, exchange socket messages and revoke logout", async ({
  browser,
  baseURL,
}) => {
  const aliceContext = await browser.newContext({ baseURL });
  const bobContext = await browser.newContext({ baseURL });
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const errors = [];
  for (const page of [alice, bob])
    page.on("pageerror", (error) => errors.push(error.message));
  try {
    await signup(alice, {
      name: "Ana Cadena",
      email: "ana.fullstack@example.invalid",
      gender: "female",
    });
    const cookie = (await aliceContext.cookies()).find(
      (cookie) => cookie.name === "jwt",
    );
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Strict");
    await alice.getByRole("link", { name: "Editar mi perfil" }).click();
    await alice.getByLabel("Nombre", { exact: true }).fill("Ana Integral");
    await alice
      .getByLabel("Biografía")
      .fill("Este perfil existe únicamente en MongoDB efímero.");
    await alice.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      alice.getByText("Cambios guardados", { exact: true }),
    ).toBeVisible();
    await alice.reload();
    await expect(alice.getByLabel("Nombre", { exact: true })).toHaveValue(
      "Ana Integral",
    );
    await expect(alice.getByLabel("Biografía")).toHaveValue(
      "Este perfil existe únicamente en MongoDB efímero.",
    );

    await signup(bob, {
      name: "Bruno Integral",
      email: "bruno.fullstack@example.invalid",
      gender: "male",
    });
    const liked = bob.waitForResponse(
      (response) =>
        response.url().includes("/api/matches/swipe-right/") &&
        response.request().method() === "POST",
    );
    await bob
      .getByRole("button", { name: "Me gusta Ana Integral", exact: true })
      .click();
    expect((await liked).status()).toBe(200);
    await expect(
      bob.getByRole("heading", { name: "Ya viste los perfiles disponibles" }),
    ).toBeVisible();
    await expect(
      bob.getByRole("link", { name: /Ana Integral.*Empiecen a conversar/ }),
    ).toHaveCount(0);
    await alice.goto("/");
    await alice
      .getByRole("button", { name: "Me gusta Bruno Integral", exact: true })
      .click();
    const aliceConnection = alice.getByRole("link", {
      name: /Bruno Integral.*Empiecen a conversar/,
    });
    const bobConnection = bob.getByRole("link", {
      name: /Ana Integral.*Empiecen a conversar/,
    });
    await expect(aliceConnection).toBeVisible();
    await expect(bobConnection).toBeVisible();
    await expect(alice.getByRole("dialog")).toBeVisible();
    await expect(bob.getByRole("dialog")).toBeVisible();
    await alice
      .getByRole("link", { name: "Empezar a conversar", exact: true })
      .click();
    await bob
      .getByRole("link", { name: "Empezar a conversar", exact: true })
      .click();
    await expect(
      alice.getByRole("heading", { name: "Saluda a Bruno Integral" }),
    ).toBeVisible();
    await expect(
      bob.getByRole("heading", { name: "Saluda a Ana Integral" }),
    ).toBeVisible();
    const historyRequests = [];
    bob.on("request", (request) => {
      if (request.url().includes("/api/messages/conversation/"))
        historyRequests.push(request.url());
    });
    await alice
      .getByLabel("Escribe un mensaje", { exact: true })
      .fill("Hola Bruno, esto recorre frontend, proxy, API y socket.");
    await alice
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .click();
    await expect(
      bob.getByText("Hola Bruno, esto recorre frontend, proxy, API y socket.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(historyRequests).toEqual([]);
    await bob
      .getByLabel("Escribe un mensaje", { exact: true })
      .fill("Hola Ana, recibido en la otra sesión.");
    await bob
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .click();
    await expect(
      alice.getByText("Hola Ana, recibido en la otra sesión.", {
        exact: false,
      }),
    ).toBeVisible();
    await alice.reload();
    await expect(
      alice.getByText("Hola Ana, recibido en la otra sesión.", {
        exact: false,
      }),
    ).toBeVisible();

    const staleCookie = await aliceContext.cookies();
    await alice.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(alice).toHaveURL("/auth");
    await alice.goto("/");
    await expect(alice).toHaveURL("/auth");
    await aliceContext.addCookies(staleCookie);
    expect((await aliceContext.request.get("/api/auth/me")).status()).toBe(401);
    await aliceContext.clearCookies();
    await alice
      .getByLabel("Correo electrónico")
      .fill("ANA.FULLSTACK@EXAMPLE.INVALID");
    await alice.getByLabel("Contraseña", { exact: true }).fill(password);
    await alice
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(alice).toHaveURL("/");
    await expect(
      alice.getByRole("link", { name: /Bruno Integral.*Empiecen a conversar/ }),
    ).toBeVisible();
    expect((await bobContext.request.get("/api/auth/me")).status()).toBe(200);
    expect(errors).toEqual([]);
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
