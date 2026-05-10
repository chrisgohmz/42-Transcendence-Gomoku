import { expect, type Page, test } from "@playwright/test";

const activeSessionKey = "proto:matchSession:v1:active";

test("human lobby creates a room and stores the returned session", async ({ page }) => {
  let createRequests = 0;
  let listRequests = 0;

  await page.route(
    (url) => url.pathname === "/api/matches",
    async (route) => {
      const request = route.request();

      if (request.method() === "POST") {
        createRequests += 1;
        expect(request.postDataJSON()).toEqual({});
        await route.fulfill({
          body: JSON.stringify({
            matchId: "created-match",
            participantId: "creator-1",
            role: "PLAYER",
            seat: "BLACK",
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      listRequests += 1;
      await route.fulfill({
        body: JSON.stringify([]),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.goto("/en/human", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Find a room/i })).toBeVisible();
  await expect.poll(() => listRequests).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Create Room" }).click();

  await expect.poll(() => createRequests).toBe(1);
  await expect.poll(async () => (await readStoredSession(page))?.matchId).toBe("created-match");

  const storedSession = await readStoredSession(page);
  expect(storedSession).toMatchObject({
    displayName: "Player",
    matchId: "created-match",
    participantId: "creator-1",
    role: "PLAYER",
    seat: "BLACK",
  });
});

test("human lobby joins a waiting room and stores the returned session", async ({ page }) => {
  let joinRequests = 0;
  let listRequests = 0;

  await page.route(
    (url) => url.pathname === "/api/matches",
    async (route) => {
      listRequests += 1;
      await route.fulfill({
        body: JSON.stringify([
          {
            boardSize: 15,
            matchId: "match-1",
            participants: [{ displayName: "Mintan", seat: "BLACK" }],
            status: "WAITING",
          },
        ]),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.route(
    (url) => url.pathname === "/api/matches/match-1/join",
    async (route) => {
      joinRequests += 1;
      expect(route.request().postDataJSON()).toEqual({});
      await route.fulfill({
        body: JSON.stringify({
          matchId: "match-1",
          participantId: "joiner-1",
          role: "PLAYER",
          seat: "WHITE",
        }),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.goto("/en/human", { waitUntil: "domcontentloaded" });
  await expect.poll(() => listRequests).toBeGreaterThan(0);
  await expect(page.getByText("Mintan's room")).toBeVisible();

  await page.getByRole("button", { name: /Join Mintan's room/ }).click();

  await expect.poll(() => joinRequests).toBe(1);
  await expect.poll(async () => (await readStoredSession(page))?.participantId).toBe("joiner-1");

  const storedSession = await readStoredSession(page);
  expect(storedSession).toMatchObject({
    displayName: "Player",
    matchId: "match-1",
    participantId: "joiner-1",
    role: "PLAYER",
    seat: "WHITE",
  });
});

async function readStoredSession(page: Page) {
  return page.evaluate((activeKey) => {
    const activeMatchId = sessionStorage.getItem(activeKey);

    if (!activeMatchId) {
      return null;
    }

    const raw = sessionStorage.getItem(`proto:matchSession:v1:${activeMatchId}`);
    return raw ? JSON.parse(raw) : null;
  }, activeSessionKey);
}
