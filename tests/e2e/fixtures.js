import { test as base, expect } from "@playwright/test";

// Every identity and conversation below is invented. This suite never starts
// Express, MongoDB, Cloudinary or the production socket server.
const portrait =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="#e6d8c7"/><circle cx="320" cy="265" r="110" fill="#98664c"/><path d="M100 800V570a220 220 0 01440 0v230" fill="#37635a"/><text x="320" y="740" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white">Perfil ficticio QA</text></svg>',
  );

export const ownId = "000000000000000000000001";
export const peerId = "000000000000000000000002";
export const ownProfile = {
  _id: ownId,
  name: "Alex Ficticio",
  email: "alex@example.test",
  age: 23,
  gender: "male",
  genderPreference: "both",
  bio: "Perfil ficticio para comprobar PoliMatch.",
  image: portrait,
};
export const peerProfile = {
  _id: peerId,
  name: "Lucía Prueba",
  age: 22,
  gender: "female",
  genderPreference: "both",
  bio: "Me gustan las bibliotecas, el cine y conversar después de clase.",
  image: portrait,
};
export const nextProfile = {
  ...peerProfile,
  _id: "000000000000000000000003",
  name: "Dani Ensayo",
  age: 24,
};

export const test = base.extend({
  fixtureApi: async ({ page }, use) => {
    const state = {
      authenticated: true,
      authFailures: 0,
      profilesFailures: 0,
      matchesFailures: 0,
      messageFailures: 0,
      sendFailures: 0,
      swipeFailures: 0,
      updateFailures: 0,
      updateGate: null,
      uploadedImageUrl: null,
      photoFailures: 0,
      user: { ...ownProfile },
      profiles: [{ ...peerProfile }, { ...nextProfile }],
      matches: [{ ...peerProfile }],
      messages: [
        {
          _id: "000000000000000000000010",
          sender: peerId,
          receiver: ownId,
          content: "Hola, este mensaje es ficticio.",
          createdAt: "2026-10-23T15:00:00.000Z",
        },
      ],
      requests: [],
      unexpected: [],
      blockedExternal: [],
      runtimeErrors: [],
    };
    page.on("pageerror", (error) => state.runtimeErrors.push(error.message));
    await page.routeWebSocket(/\/socket\.io\//, (socket) => socket.close());
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.startsWith("/socket.io/")) return route.abort();
      if (url.origin !== "http://127.0.0.1:5178") {
        state.blockedExternal.push(url.origin + url.pathname);
        return route.abort();
      }
      if (url.pathname === "/qa-uploaded-avatar.svg")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: decodeURIComponent(portrait.split(",")[1]),
        });
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const path = url.pathname.slice(4);
      const method = request.method();
      const body = request.postDataJSON();
      state.requests.push({ method, path, body });
      const reply = (data, status = 200) =>
        route.fulfill({ status, json: data });
      const fail = (key) => {
        if (state[key] > 0) {
          state[key]--;
          return true;
        }
        return false;
      };
      if (path === "/auth/me") {
        if (fail("authFailures"))
          return reply(
            {
              success: false,
              message: "No se pudo comprobar la sesión ficticia.",
            },
            503,
          );
        return state.authenticated
          ? reply({ success: true, user: state.user })
          : reply({ success: false, message: "Sin sesión." }, 401);
      }
      if (method === "POST" && ["/auth/login", "/auth/signup"].includes(path)) {
        state.authenticated = true;
        return reply({ success: true, user: state.user });
      }
      if (path === "/auth/logout") {
        state.authenticated = false;
        return reply({ success: true });
      }
      if (path === "/matches/user-profiles") {
        if (fail("profilesFailures"))
          return reply(
            {
              success: false,
              message: "No se pudieron cargar los perfiles ficticios.",
            },
            503,
          );
        return reply({ success: true, users: state.profiles });
      }
      if (path === "/matches") {
        if (fail("matchesFailures"))
          return reply(
            {
              success: false,
              message: "No se pudieron cargar las conexiones ficticias.",
            },
            503,
          );
        return reply({ success: true, matches: state.matches });
      }
      if (/^\/matches\/swipe-(left|right)\//.test(path)) {
        if (fail("swipeFailures"))
          return reply(
            {
              success: false,
              message: "No se pudo guardar tu elección ficticia.",
            },
            503,
          );
        const id = path.split("/").at(-1);
        state.profiles = state.profiles.filter((profile) => profile._id !== id);
        return reply({ success: true, isMatch: false });
      }
      if (path === "/users/photos" && method === "POST") {
        if (fail("photoFailures"))
          return reply({ message: "No se pudo subir la foto ficticia." }, 503);
        const photos =
          state.user.photos || (state.user.image ? [state.user.image] : []);
        state.user = {
          ...state.user,
          photos: [...photos, "http://127.0.0.1:5178/qa-uploaded-avatar.svg"],
        };
        state.user.image = state.user.photos[0];
        return reply({ success: true, user: state.user }, 201);
      }
      if (path === "/users/update" && method === "PUT") {
        if (state.updateGate) await state.updateGate;
        if (fail("updateFailures"))
          return reply(
            {
              success: false,
              message: "No se pudo guardar el perfil ficticio.",
            },
            503,
          );
        state.user = { ...state.user, ...body };
        if (body.photos) state.user.image = body.photos[0] || "";
        if (body.image?.startsWith("data:") && state.uploadedImageUrl)
          state.user.image = state.uploadedImageUrl;
        return reply({ success: true, user: state.user });
      }
      if (path.startsWith("/messages/conversation/")) {
        if (fail("messageFailures"))
          return reply(
            {
              success: false,
              message: "No se pudo cargar la conversación ficticia.",
            },
            503,
          );
        return reply({
          success: true,
          messages: state.messages,
          hasMore: false,
          nextCursor: null,
        });
      }
      if (path === "/messages/send" && method === "POST") {
        if (fail("sendFailures"))
          return reply(
            {
              success: false,
              message: "No se pudo enviar el mensaje ficticio.",
            },
            503,
          );
        const message = {
          _id: "000000000000000000000011",
          sender: ownId,
          receiver: body.receiverId,
          content: body.content,
          createdAt: "2026-10-23T15:01:00.000Z",
        };
        state.messages.push(message);
        return reply({ success: true, message });
      }
      state.unexpected.push({ method, path });
      return reply(
        { success: false, message: "Ruta no definida por los fixtures de QA." },
        501,
      );
    });
    await use(state);
    expect(
      state.unexpected,
      "Todas las rutas API deben estar cubiertas por fixtures explícitos.",
    ).toEqual([]);
    expect(
      state.blockedExternal,
      "La aplicación no debe depender de servicios externos durante QA.",
    ).toEqual([]);
    expect(
      state.runtimeErrors,
      "Los recorridos no deben producir excepciones JavaScript sin manejar.",
    ).toEqual([]);
  },
});

export { expect };

export async function expectNoHorizontalOverflow(page) {
  const overflowing = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [
      ...document.querySelectorAll(
        "main, header, nav, form, button, input, textarea, select, h1, h2",
      ),
    ]
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.width > 0 && (bounds.left < -1 || bounds.right > width + 1)
        );
      })
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent || element.getAttribute("aria-label") || "")
          .trim()
          .slice(0, 70),
      }));
  });
  expect(
    overflowing,
    "Los elementos funcionales deben caber en el viewport.",
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
