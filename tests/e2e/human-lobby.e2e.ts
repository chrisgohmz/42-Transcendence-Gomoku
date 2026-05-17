import { expect, type Page, test } from "@playwright/test";

const activeSessionKey = "match:session:v1:active";

test("human lobby creates a room and stores the returned session", async ({ page }) => {
  let createRequests = 0;
  let listRequests = 0;

  await page.route(
    (url) => url.pathname === "/api/matches",
    async (route) => {
      const request = route.request();

      if (request.method() === "POST") {
        createRequests += 1;
        expect(request.postDataJSON()).toEqual({ visibility: "PUBLIC" });
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
  await page.route(
    (url) => url.pathname === "/api/matches/created-match/state",
    async (route) => {
      await route.fulfill({
        body: JSON.stringify(matchStateResponse("created-match", "creator-1", "BLACK", "WAITING")),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.goto("/en/human", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Find Your Next Opponent/i })).toBeVisible();
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
  await expect(page).toHaveURL(/\/en\/human$/);
  await expect(page.getByTestId("human-match-room")).toBeVisible();
  await expect(page.getByTestId("human-match-board")).toBeVisible();
});

test("human lobby creates a private room with its password and visibility", async ({ page }) => {
  let createRequests = 0;

  await page.route(
    (url) => url.pathname === "/api/matches",
    async (route) => {
      const request = route.request();

      if (request.method() === "POST") {
        createRequests += 1;
        expect(request.postDataJSON()).toEqual({
          name: "Study Room",
          password: "sente",
          visibility: "PRIVATE",
        });
        await route.fulfill({
          body: JSON.stringify({
            matchId: "private-match",
            participantId: "creator-private",
            role: "PLAYER",
            seat: "BLACK",
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify([]),
        contentType: "application/json",
        status: 200,
      });
    },
  );
  await page.route(
    (url) => url.pathname === "/api/matches/private-match/state",
    async (route) => {
      await route.fulfill({
        body: JSON.stringify(
          matchStateResponse("private-match", "creator-private", "BLACK", "WAITING"),
        ),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.goto("/en/human", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Private" }).click();
  await page.getByLabel("Room name").fill("Study Room");
  await page.getByLabel("Password").fill("sente");
  await page.getByRole("button", { name: "Create Room" }).click();

  await expect.poll(() => createRequests).toBe(1);
  await expect.poll(async () => (await readStoredSession(page))?.matchId).toBe("private-match");
  await expect(page.getByTestId("human-match-room")).toBeVisible();
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
  await page.route(
    (url) => url.pathname === "/api/matches/match-1/state",
    async (route) => {
      await route.fulfill({
        body: JSON.stringify(matchStateResponse("match-1", "joiner-1", "WHITE", "IN_PROGRESS")),
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
  await expect(page).toHaveURL(/\/en\/human$/);
  await expect(page.getByTestId("human-match-room")).toBeVisible();
  await expect(page.getByTestId("human-match-board")).toBeVisible();
});

async function readStoredSession(page: Page) {
  return page.evaluate((activeKey) => {
    const activeMatchId = sessionStorage.getItem(activeKey);

    if (!activeMatchId) {
      return null;
    }

    const raw = sessionStorage.getItem(`match:session:v1:${activeMatchId}`);
    return raw ? JSON.parse(raw) : null;
  }, activeSessionKey);
}

function matchStateResponse(
  matchId: string,
  participantId: string,
  seat: "BLACK" | "WHITE",
  status: "WAITING" | "IN_PROGRESS",
) {
  const board = Array.from({ length: 15 }, () =>
    Array.from({ length: 15 }, () => ({ occupied: false })),
  );
  const otherSeat = seat === "BLACK" ? "WHITE" : "BLACK";

  return {
    matchId,
    status,
    visibility: "PUBLIC",
    boardSize: 15,
    stateVersion: 0,
    nextTurnSeat: status === "IN_PROGRESS" ? "BLACK" : null,
    winningSeat: null,
    endReason: null,
    participants: [
      {
        participantId,
        displayName: "Player",
        role: "PLAYER",
        seat,
        joinedAt: "2026-05-10T00:00:00.000Z",
        leftAt: null,
      },
      ...(status === "IN_PROGRESS"
        ? [
            {
              participantId: "opponent-1",
              displayName: "Opponent",
              role: "PLAYER",
              seat: otherSeat,
              joinedAt: "2026-05-10T00:00:01.000Z",
              leftAt: null,
            },
          ]
        : []),
    ],
    moves: [],
    board,
  };
}
