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

type AllowedResponseStatus = {
  resourceType: string;
  status: number;
  url?: string;
};

type AllowedPageError = {
  browserName?: string;
  message: string;
};

type LabelName = Parameters<Page["getByLabel"]>[0];
type LabelOptions = Parameters<Page["getByLabel"]>[1];

const allowedPageErrorAnnotation = "allow-page-error";
const allowedResponseStatusAnnotation = "allow-response-status";

export function allowResponseStatus(
  testInfo: TestInfo,
  {
    resourceType = "document",
    status,
    url,
  }: {
    resourceType?: string;
    status: number;
    url?: string;
  },
) {
  testInfo.annotations.push({
    description: JSON.stringify({ resourceType, status, url } satisfies AllowedResponseStatus),
    type: allowedResponseStatusAnnotation,
  });
}

export function allowPageError(
  testInfo: TestInfo,
  {
    browserName,
    message,
  }: {
    browserName?: string;
    message: string;
  },
) {
  testInfo.annotations.push({
    description: JSON.stringify({ browserName, message } satisfies AllowedPageError),
    type: allowedPageErrorAnnotation,
  });
}

export function visibleLabel(page: Page, name: LabelName, options?: LabelOptions): Locator {
  return page.getByLabel(name, options).filter({ visible: true }).first();
}

export const test = base.extend<ConsoleGuardFixtures>({
  consoleDiagnostics: [
    async ({ browserName, context }, use, testInfo) => {
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

          if (diagnostic && !isAllowedConsoleStatus(testInfo, message)) {
            diagnostics.push(diagnostic);
          }
        };
        const onPageError = (error: Error) => {
          if (isAllowedPageError(testInfo, browserName, error)) {
            return;
          }

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

          if (
            diagnostic &&
            !isAllowedResponseStatus(
              testInfo,
              response.status(),
              request.resourceType(),
              response.url(),
            )
          ) {
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

function isAllowedResponseStatus(
  testInfo: TestInfo,
  status: number,
  resourceType: string,
  url?: string,
) {
  return getAllowedResponseStatuses(testInfo).some(
    (allowed) =>
      allowed.status === status &&
      allowed.resourceType === resourceType &&
      (!allowed.url || allowed.url === url),
  );
}

function isAllowedConsoleStatus(testInfo: TestInfo, message: ConsoleMessage) {
  const status = getConsoleStatus(message.text());

  if (!status) {
    return false;
  }

  const sourceUrl = getConsoleSourceUrl(message.text()) ?? message.location().url;

  return getAllowedResponseStatuses(testInfo).some((allowed) => {
    if (allowed.status !== status) {
      return false;
    }

    if (allowed.resourceType === "document") {
      return Boolean(allowed.url && allowed.url === sourceUrl);
    }

    return !allowed.url || allowed.url === sourceUrl;
  });
}

function isAllowedPageError(testInfo: TestInfo, browserName: string, error: Error) {
  return getAllowedPageErrors(testInfo).some((allowed) => {
    if (allowed.browserName && allowed.browserName !== browserName) {
      return false;
    }

    return allowed.message === error.message;
  });
}

function getAllowedResponseStatuses(testInfo: TestInfo): AllowedResponseStatus[] {
  return testInfo.annotations.flatMap((annotation) => {
    if (annotation.type !== allowedResponseStatusAnnotation || !annotation.description) {
      return [];
    }

    return parseAnnotation<AllowedResponseStatus>(annotation.description, (value) => {
      if (
        typeof value["resourceType"] === "string" &&
        typeof value["status"] === "number" &&
        (value["url"] === undefined || typeof value["url"] === "string")
      ) {
        return {
          resourceType: value["resourceType"],
          status: value["status"],
          url: value["url"],
        };
      }

      return null;
    });
  });
}

function getAllowedPageErrors(testInfo: TestInfo): AllowedPageError[] {
  return testInfo.annotations.flatMap((annotation) => {
    if (annotation.type !== allowedPageErrorAnnotation || !annotation.description) {
      return [];
    }

    return parseAnnotation<AllowedPageError>(annotation.description, (value) => {
      if (
        typeof value["message"] === "string" &&
        (value["browserName"] === undefined || typeof value["browserName"] === "string")
      ) {
        return {
          browserName: value["browserName"],
          message: value["message"],
        };
      }

      return null;
    });
  });
}

function parseAnnotation<T>(
  description: string,
  parseValue: (value: Record<string, unknown>) => T | null,
): T[] {
  try {
    const value: unknown = JSON.parse(description);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const parsed = parseValue(value as Record<string, unknown>);
      return parsed ? [parsed] : [];
    }
  } catch {
    return [];
  }

  return [];
}

function getConsoleStatus(text: string) {
  const match = /status of (\d{3})/.exec(text);

  return match?.[1] ? Number(match[1]) : null;
}

function getConsoleSourceUrl(text: string) {
  const match = /(?:source|resource) [“"]([^”"]+)[”"]/.exec(text);

  return match?.[1] ?? null;
}
