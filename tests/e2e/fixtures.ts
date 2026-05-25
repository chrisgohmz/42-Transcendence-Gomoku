import { expect, test as base } from "@playwright/test";
import type { ConsoleMessage, Locator, Page, Request, Response, TestInfo } from "@playwright/test";

import {
  formatDiagnostic,
  getConsoleDiagnostic,
  getPageErrorDiagnostic,
  getRequestFailedDiagnostic,
  getResponseDiagnostic,
  type BrowserDiagnostic,
} from "./browser-diagnostics";

type ConsoleGuardFixtures = {
  consoleDiagnostics: void;
};

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
          const diagnostic = getConsoleDiagnostic({
            location: message.location(),
            text: message.text(),
            type: message.type(),
          });

          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
        };
        const onPageError = (error: Error) => {
          diagnostics.push(getPageErrorDiagnostic(error));
        };
        const onRequestFailed = (request: Request) => {
          const diagnostic = getRequestFailedDiagnostic({
            failureText: request.failure()?.errorText,
            method: request.method(),
            resourceType: request.resourceType(),
            url: request.url(),
          });

          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
        };
        const onResponse = (response: Response) => {
          const request = response.request();
          const diagnostic = getResponseDiagnostic({
            method: request.method(),
            resourceType: request.resourceType(),
            status: response.status(),
            url: response.url(),
          });

          if (diagnostic) {
            diagnostics.push(diagnostic);
          }
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
