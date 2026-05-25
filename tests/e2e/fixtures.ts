import { expect, test as base } from "@playwright/test";
import type { ConsoleMessage, Locator, Page, Request, Response, TestInfo } from "@playwright/test";

type BrowserDiagnostic = {
  location?: ReturnType<ConsoleMessage["location"]>;
  text: string;
  type: string;
};

type ConsoleGuardFixtures = {
  consoleDiagnostics: void;
};

function formatDiagnostic(diagnostic: BrowserDiagnostic) {
  const location = diagnostic.location;
  const source =
    location && (location.url || location.lineNumber || location.columnNumber)
      ? ` at ${location.url}:${location.lineNumber}:${location.columnNumber}`
      : "";

  return `[${diagnostic.type}]${source} ${diagnostic.text}`;
}

function shouldFailOnRequest(request: Request) {
  const resourceType = request.resourceType();

  if (resourceType === "fetch" || resourceType === "xhr") {
    return new URL(request.url()).pathname === "/favicon.ico";
  }

  return (
    ["document", "font", "image", "manifest", "script", "stylesheet"].includes(resourceType) ||
    new URL(request.url()).pathname === "/favicon.ico"
  );
}

export const test = base.extend<ConsoleGuardFixtures>({
  consoleDiagnostics: [
    async ({ context }, use) => {
      const diagnostics: BrowserDiagnostic[] = [];
      const pageHandlers = new Map<
        Page,
        {
          onConsole: (message: ConsoleMessage) => void;
          onPageError: (error: Error) => void;
          onRequestFailed: (request: Request) => void;
          onResponse: (response: Response) => void;
        }
      >();

      const attachPage = (page: Page) => {
        if (pageHandlers.has(page)) {
          return;
        }

        const onConsole = (message: ConsoleMessage) => {
          if (message.type() !== "warning" && message.type() !== "error") {
            return;
          }

          diagnostics.push({
            location: message.location(),
            text: message.text(),
            type: `console.${message.type()}`,
          });
        };
        const onPageError = (error: Error) => {
          diagnostics.push({
            text: error.stack ?? error.message,
            type: "pageerror",
          });
        };
        const onRequestFailed = (request: Request) => {
          if (!shouldFailOnRequest(request)) {
            return;
          }

          diagnostics.push({
            text: `${request.method()} ${request.url()} failed: ${
              request.failure()?.errorText ?? "unknown network failure"
            }`,
            type: `requestfailed.${request.resourceType()}`,
          });
        };
        const onResponse = (response: Response) => {
          const request = response.request();

          if (response.status() < 400 || !shouldFailOnRequest(request)) {
            return;
          }

          diagnostics.push({
            text: `${request.method()} ${response.url()} returned ${response.status()}`,
            type: `response.${request.resourceType()}`,
          });
        };

        page.on("console", onConsole);
        page.on("pageerror", onPageError);
        page.on("requestfailed", onRequestFailed);
        page.on("response", onResponse);
        pageHandlers.set(page, { onConsole, onPageError, onRequestFailed, onResponse });
      };

      for (const page of context.pages()) {
        attachPage(page);
      }
      context.on("page", attachPage);

      await use();

      context.off("page", attachPage);
      for (const [page, handlers] of pageHandlers) {
        page.off("console", handlers.onConsole);
        page.off("pageerror", handlers.onPageError);
        page.off("requestfailed", handlers.onRequestFailed);
        page.off("response", handlers.onResponse);
      }

      expect(
        diagnostics.map(formatDiagnostic),
        "browser console warnings/errors and failed page assets should not be emitted during E2E tests",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { ConsoleMessage, Locator, Page, TestInfo };
