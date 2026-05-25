import { expect, type Locator, type Page, test } from "./fixtures";

const activeSessionKey = "match:session:v1:active";

test("AI lobby starts a solo match and renders the shared match board", async ({ page }) => {
  let startRequests = 0;
  let stateRequests = 0;

  await page.route(
    (url) => url.pathname === "/api/matches/solo",
    async (route) => {
      startRequests += 1;
      expect(route.request().postDataJSON()).toMatchObject({
        difficulty: "expert",
        playerSeat: "BLACK",
      });
      await route.fulfill({
        body: JSON.stringify({
          difficulty: "expert",
          matchId: "ai-match",
          participantId: "human-1",
          role: "PLAYER",
          seat: "BLACK",
        }),
        contentType: "application/json",
        status: 200,
      });
    },
  );
  await page.route(
    (url) => url.pathname === "/api/matches/ai-match/state",
    async (route) => {
      stateRequests += 1;
      await route.fulfill({
        body: JSON.stringify(matchStateResponse()),
        contentType: "application/json",
        status: 200,
      });
    },
  );

  await page.goto("/en/game", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose your opponent." }),
  ).toBeVisible();

  const startTrainingButton = page.getByRole("button", { name: "Start Training" });
  await expect(startTrainingButton).toBeEnabled({ timeout: 30_000 });
  await startTrainingButton.click();

  await expect.poll(() => startRequests).toBe(1);
  await expect.poll(() => stateRequests).toBeGreaterThan(0);
  await expect.poll(async () => (await readStoredSession(page))?.mode).toBe("ai");
  await expect(page.getByTestId("ai-match-room")).toBeVisible();

  const board = page.getByRole("grid", { name: "AI Gomoku board" });
  const boardCells = board.getByRole("gridcell");
  await expect(board).toBeVisible();
  await expect(boardCells).toHaveCount(225);
  expect(await countBoardTabStops(board)).toBe(1);
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

async function countBoardTabStops(board: Locator) {
  return board
    .getByRole("gridcell")
    .evaluateAll((cells) => cells.filter((cell) => cell.getAttribute("tabindex") === "0").length);
}

function matchStateResponse() {
  const board = Array.from({ length: 15 }, () =>
    Array.from({ length: 15 }, () => ({ occupied: false })),
  );

  return {
    aiDifficulty: "expert",
    board,
    boardSize: 15,
    endReason: null,
    matchId: "ai-match",
    mode: "ai",
    moves: [],
    nextTurnSeat: "BLACK",
    participants: [
      {
        displayName: "Player",
        joinedAt: "2026-05-10T00:00:00.000Z",
        leftAt: null,
        participantId: "human-1",
        role: "PLAYER",
        seat: "BLACK",
      },
      {
        displayName: "Kata Reader · Expert",
        joinedAt: "2026-05-10T00:00:01.000Z",
        leftAt: null,
        participantId: "ai-1",
        role: "PLAYER",
        seat: "WHITE",
      },
    ],
    stateVersion: 0,
    status: "IN_PROGRESS",
    visibility: "PRIVATE",
    winningSeat: null,
  };
}
