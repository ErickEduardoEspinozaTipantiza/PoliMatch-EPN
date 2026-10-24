import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  expectNoHorizontalOverflow,
  peerId,
} from "./fixtures.js";

async function inspectScreen(page, testInfo, name) {
  await expectNoHorizontalOverflow(page);
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const significant = scan.violations.filter((item) =>
    ["serious", "critical"].includes(item.impact),
  );
  await testInfo.attach(`${name}-axe-fixtures`, {
    body: JSON.stringify({ violations: scan.violations }, null, 2),
    contentType: "application/json",
  });
  expect
    .soft(
      significant.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => node.target),
      })),
      `${name}: axe serious/critical`,
    )
    .toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath(`${name}-fictional-fixtures.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("login accesible por teclado y formulario dentro de pantalla", async ({
  page,
  fixtureApi,
}, testInfo) => {
  fixtureApi.authenticated = false;
  await page.goto("/auth");
  const email = page.locator("input[type=email]");
  const password = page.locator("input[type=password]");
  await expect(email).toBeVisible();
  await inspectScreen(page, testInfo, "login");
  await email.focus();
  await page.keyboard.type("alex@example.test");
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  const focus = await password.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(focus, "El control enfocado necesita una señal visual.").toBe(true);
  await page.keyboard.type("Ficticia-Segura-2026");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
});

test("registro completo permite crear cuenta ficticia en móvil y escritorio", async ({
  page,
  fixtureApi,
}, testInfo) => {
  fixtureApi.authenticated = false;
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await expect(page.locator("input[name=name]")).toBeVisible();
  await inspectScreen(page, testInfo, "registration");
  await page.locator("input[name=name]").fill("Alex Ficticio");
  await page.locator("input[type=email]").fill("alex@example.test");
  await page.locator("input[type=password]").fill("Ficticia-Segura-2026");
  await page.locator("input[type=number]").fill("23");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("input[name=gender][value=male]").check();
  await page.locator("input[value=both]").check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("form button[type=submit]").click();
  await page
    .getByRole("link", { name: /Añadir fotos más tarde|Empezar a descubrir/ })
    .click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
  expect(
    fixtureApi.requests.find((request) => request.path === "/auth/signup")
      ?.body,
  ).toMatchObject({
    name: "Alex Ficticio",
    email: "alex@example.test",
    age: 23,
    gender: "male",
    genderPreference: "both",
  });
});

test("descubrimiento y edición de perfil mantienen datos al fallar y permiten guardar", async ({
  page,
  fixtureApi,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
  if (testInfo.project.use.viewport.width < 768) {
    const action = await page
      .getByRole("button", { name: /me gusta/i })
      .boundingBox();
    const navigation = await page
      .getByRole("navigation", { name: /móvil/i })
      .boundingBox();
    expect(
      action.y + action.height,
      "La acción principal debe quedar por encima de la navegación fija.",
    ).toBeLessThanOrEqual(navigation.y);
  }
  await inspectScreen(page, testInfo, "discovery");
  await page.getByRole("link", { name: "Editar mi perfil" }).click();
  await expect(page).toHaveURL("/profile");
  await inspectScreen(page, testInfo, "profile");
  const name = page.getByLabel(/^nombre/i);
  const bio = page.getByLabel(/sobre ti|biograf|presentaci/i);
  await name.fill("Alex Perfil Editado");
  await bio.fill("Este perfil editado también es completamente ficticio.");
  fixtureApi.updateFailures = 1;
  await page.getByRole("button", { name: /guardar/i }).click();
  await expect(
    page.getByText("No se pudo guardar el perfil ficticio."),
  ).toBeVisible();
  await expect(name).toHaveValue("Alex Perfil Editado");
  await expect(name).toBeEnabled();
  await expect(bio).toBeEnabled();
  await page.getByRole("button", { name: /guardar/i }).click();
  await expect(page.getByText("Tu perfil se ha guardado.")).toBeVisible();
  await page
    .getByRole("link", { name: /descubrir/i })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Editar mi perfil" }).click();
  await expect(name).toHaveValue("Alex Perfil Editado");
  await expect(bio).toHaveValue(
    "Este perfil editado también es completamente ficticio.",
  );
  await name.fill("Cambio ficticio descartado");
  await bio.fill("Esta edición no debe guardarse.");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(name).toHaveValue("Alex Perfil Editado");
  await expect(bio).toHaveValue(
    "Este perfil editado también es completamente ficticio.",
  );
});

test("guardar perfil bloquea nuevas ediciones hasta confirmar la versión enviada", async ({
  page,
  fixtureApi,
}) => {
  let confirmSave;
  fixtureApi.updateGate = new Promise((resolve) => {
    confirmSave = resolve;
  });
  await page.goto("/profile");
  const name = page.getByLabel(/^nombre/i);
  const bio = page.getByLabel("Biografía");
  await name.fill("  Alex Perfil Confirmado  ");
  await bio.fill("Esta es la versión enviada, completamente ficticia.");
  await page.getByRole("button", { name: /guardar/i }).click();
  try {
    await expect
      .poll(
        () =>
          fixtureApi.requests.filter(
            (request) => request.path === "/users/update",
          ).length,
      )
      .toBe(1);
    await expect(name).toBeDisabled();
    await expect(page.getByLabel("Edad", { exact: true })).toBeDisabled();
    await expect(bio).toBeDisabled();
    for (const radio of await page.getByRole("radio").all())
      await expect(radio).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Cambiar foto" }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  } finally {
    confirmSave();
  }
  await expect(page.locator(".profile-status")).toHaveText("Cambios guardados");
  await expect(name).toHaveValue("Alex Perfil Confirmado");
  await expect(bio).toHaveValue(
    "Esta es la versión enviada, completamente ficticia.",
  );
  await expect(name).toBeEnabled();
  await expect(bio).toBeEnabled();
});

test("guardar una foto adopta su URL confirmada y evita subir de nuevo el archivo", async ({
  page,
  fixtureApi,
}) => {
  const uploadedUrl = "http://127.0.0.1:5178/qa-uploaded-avatar.svg";
  fixtureApi.uploadedImageUrl = uploadedUrl;
  await page.goto("/profile");
  await page.getByLabel("Seleccionar foto de perfil").setInputFiles({
    name: "avatar-ficticio.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const preview = page
    .getByRole("region", { name: "Foto de perfil" })
    .locator(".avatar img");
  await expect(preview).toHaveAttribute("src", /^data:image\/png;base64,/);
  await page.getByRole("button", { name: /guardar/i }).click();
  await expect(page.locator(".profile-status")).toHaveText("Cambios guardados");
  await page
    .getByLabel("Biografía")
    .fill("Segunda edición ficticia, con la misma foto guardada.");
  await page.getByRole("button", { name: /guardar/i }).click();
  await expect(page.locator(".profile-status")).toHaveText("Cambios guardados");
  const updates = fixtureApi.requests.filter(
    (request) => request.path === "/users/update",
  );
  expect(updates).toHaveLength(2);
  expect(updates[0].body.image).toMatch(/^data:image\/png;base64,/);
  expect(
    updates[1].body.image,
    "Otra edición debe reutilizar la URL confirmada.",
  ).toBe(uploadedUrl);
  await expect(preview).toHaveAttribute("src", uploadedUrl);
});

test("pasar y like funcionan sin gesto y un fallo conserva la tarjeta para reintentar", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.swipeFailures = 1;
  await page.goto("/");
  const pass = page.getByRole("button", { name: /pasar/i });
  await pass.click();
  await expect(
    page.getByText("No se pudo guardar tu elección ficticia."),
  ).toBeVisible();
  await expect(pass).toBeEnabled();
  // The current discovery card must remain after a failed server acknowledgement.
  await expect(
    page.getByRole("heading", { name: /Lucía Prueba/, level: 2 }),
  ).toBeVisible();
  await pass.click();
  await expect(
    page.getByRole("heading", { name: /Dani Ensayo/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /me gusta|like/i }).click();
  await expect(page.getByRole("button", { name: /pasar/i })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /viste.*perfiles|sin.*perfiles/i }),
  ).toBeVisible();
});

test("chat accesible conserva borrador si falla el envío y lo limpia solo al confirmar", async ({
  page,
  fixtureApi,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Lucía Prueba/ }).click();
  await expect(page).toHaveURL(`/chat/${peerId}`);
  await expect(page.getByText("Hola, este mensaje es ficticio.")).toBeVisible();
  await inspectScreen(page, testInfo, "chat");
  const input = page.getByRole("textbox", { name: /mensaje/i });
  const text = "Mensaje ficticio que debe conservarse si falla.";
  await input.fill(text);
  fixtureApi.sendFailures = 1;
  await page.getByRole("button", { name: /^enviar/i }).click();
  await expect(
    page.getByText("No se pudo enviar el mensaje ficticio."),
  ).toBeVisible();
  await expect(input).toHaveValue(text);
  await input.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".message-bubble").filter({ hasText: text }),
  ).toBeVisible();
  await expect(input).toHaveValue("");
  await expectNoHorizontalOverflow(page);
});

test("error de perfiles tiene recuperación y no se presenta como lista vacía", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.profilesFailures = Infinity;
  await page.goto("/");
  await expect(
    page.getByText("No se pudieron cargar los perfiles ficticios."),
  ).toBeVisible();
  fixtureApi.profilesFailures = 0;
  await page
    .getByRole("button", { name: /reintentar/i })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("error de conversación permite reintentar la lectura", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.messageFailures = Infinity;
  await page.goto(`/chat/${peerId}`);
  await expect(
    page.getByText("No se pudo cargar la conversación ficticia."),
  ).toBeVisible();
  fixtureApi.messageFailures = 0;
  await page.getByRole("button", { name: /reintentar/i }).click();
  await expect(page.getByText("Hola, este mensaje es ficticio.")).toBeVisible();
});

test("error al comprobar sesión permite reintentar sin perder la sesión ficticia", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.authFailures = 1;
  await page.goto("/");
  await expect(
    page.getByText("No se pudo comprobar la sesión ficticia."),
  ).toBeVisible();
  await page.getByRole("button", { name: /reintentar/i }).click();
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
});

test("ruta desconocida conserva salida de navegación accesible", async ({
  page,
  fixtureApi,
}, testInfo) => {
  void fixtureApi;
  await page.goto("/ruta-ficticia-inexistente");
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page.getByText(/página.*no.*disponible/i)).toBeVisible();
  await inspectScreen(page, testInfo, "not-found");
  await page.locator("main").getByRole("link").first().click();
  await expect(page).toHaveURL("/");
});

test("preferencia de movimiento reducido desactiva animaciones prolongadas", async ({
  page,
  fixtureApi,
}) => {
  void fixtureApi;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /pasar/i })).toBeVisible();
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll("*")].flatMap((element) => {
      const style = getComputedStyle(element);
      const tooLong = (value) =>
        value
          .split(",")
          .some(
            (duration) =>
              parseFloat(duration) *
                (duration.trim().endsWith("ms") ? 1 : 1000) >
              10,
          );
      return (style.animationName !== "none" &&
        tooLong(style.animationDuration)) ||
        tooLong(style.transitionDuration)
        ? [
            {
              tag: element.tagName,
              animation: style.animationName,
              transition: style.transitionDuration,
            },
          ]
        : [];
    }),
  );
  expect(
    animated,
    "El CSS debe respetar la preferencia real del navegador.",
  ).toEqual([]);
  // CSS duration rules alone cannot disable the JavaScript card spring.
  // An incomplete gesture must settle immediately, rather than spring back.
  const displaced = await page
    .locator(".swipe-card-wrapper")
    .last()
    .evaluate(async (element) => {
      const bounds = element.getBoundingClientRect();
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      element.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }),
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: x + 45,
          clientY: y,
        }),
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          clientX: x + 45,
          clientY: y,
        }),
      );
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return Math.abs(matrix.m41) + Math.abs(matrix.m42);
    });
  expect(
    displaced,
    "La tarjeta debe quedar quieta al soltar un gesto con movimiento reducido.",
  ).toBeLessThan(0.1);
});

test("sin perfiles ni conexiones presenta estados vacíos útiles", async ({
  page,
  fixtureApi,
}) => {
  fixtureApi.profiles = [];
  fixtureApi.matches = [];
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /viste.*perfiles/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /aquí empieza una conexión/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /pasar/i })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /volver a buscar/i }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("cerrar sesión retira el contenido privado y protege perfil", async ({
  page,
  fixtureApi,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Lucía Prueba/ })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL("/auth");
  await expect(page.getByRole("link", { name: /Lucía Prueba/ })).toHaveCount(0);
  await page.goto("/profile");
  await expect(page).toHaveURL("/auth");
  await expect(page.locator("input[type=email]")).toBeVisible();
  expect(fixtureApi.authenticated).toBe(false);
});
