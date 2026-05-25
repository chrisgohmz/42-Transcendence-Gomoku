import { describe, expect, test } from "bun:test";

import {
  formatDiagnostic,
  getConsoleDiagnostic,
  getPageErrorDiagnostic,
  getRequestFailedDiagnostic,
  getResponseDiagnostic,
  shouldFailOnRequest,
} from "./browser-diagnostics";

describe("browser diagnostics", () => {
  test("characterizes console warnings and errors as failing diagnostics", () => {
    expect(
      getConsoleDiagnostic({
        location: {
          columnNumber: 7,
          lineNumber: 42,
          url: "http://localhost:3000/_next/static/chunk.js",
        },
        text: "Missing resource",
        type: "warning",
      }),
    ).toEqual({
      location: {
        columnNumber: 7,
        lineNumber: 42,
        url: "http://localhost:3000/_next/static/chunk.js",
      },
      text: "Missing resource",
      type: "console.warning",
    });
    expect(
      getConsoleDiagnostic({
        text: "Hydration failed",
        type: "error",
      }),
    ).toEqual({
      text: "Hydration failed",
      type: "console.error",
    });
    expect(
      getConsoleDiagnostic({
        text: "Debug output",
        type: "log",
      }),
    ).toBeNull();
  });

  test("ignores Socket.IO transport teardown noise while keeping real socket failures", () => {
    expect(
      getConsoleDiagnostic({
        location: {
          url: "http://localhost:3000/_next/static/chunks/socket.js",
        },
        text: "WebSocket connection to 'ws://localhost:3001/socket.io/?EIO=4&transport=websocket' failed: WebSocket is closed before the connection is established.",
        type: "warning",
      }),
    ).toBeNull();
    expect(
      getConsoleDiagnostic({
        location: {
          url: "http://localhost:3001/socket.io/?EIO=4&transport=polling&sid=session",
        },
        text: "Failed to load resource: the server responded with a status of 400 (Bad Request)",
        type: "error",
      }),
    ).toBeNull();
    expect(
      getConsoleDiagnostic({
        location: {
          url: "http://localhost:3000/_next/static/chunks/socket.js",
        },
        text: '[JavaScript Error: "Firefox cannot establish a connection to the server at ws://localhost:3001/socket.io/?EIO=4&transport=websocket&sid=session." {file: "http://localhost:3000/_next/static/chunks/socket.js" line: 1}]',
        type: "error",
      }),
    ).toBeNull();
    expect(
      getConsoleDiagnostic({
        location: {
          url: "http://localhost:3000/_next/static/chunks/socket.js",
        },
        text: '[JavaScript Error: "The connection to ws://localhost:3001/socket.io/?EIO=4&transport=websocket&sid=session was interrupted while the page was loading." {file: "http://localhost:3000/_next/static/chunks/socket.js" line: 1}]',
        type: "error",
      }),
    ).toBeNull();
    expect(
      getConsoleDiagnostic({
        location: {
          url: "http://localhost:3001/socket.io/?EIO=4&transport=polling",
        },
        text: "Failed to load resource: net::ERR_CONNECTION_REFUSED",
        type: "error",
      }),
    ).toEqual({
      location: {
        url: "http://localhost:3001/socket.io/?EIO=4&transport=polling",
      },
      text: "Failed to load resource: net::ERR_CONNECTION_REFUSED",
      type: "console.error",
    });
  });

  test("characterizes page asset requests as guarded while leaving API fetches alone", () => {
    for (const resourceType of ["document", "font", "image", "manifest", "script", "stylesheet"]) {
      expect(
        shouldFailOnRequest({
          method: "GET",
          resourceType,
          url: `http://localhost:3000/assets/example-${resourceType}`,
        }),
      ).toBe(true);
    }

    expect(
      shouldFailOnRequest({
        method: "GET",
        resourceType: "xhr",
        url: "http://localhost:3000/api/matches",
      }),
    ).toBe(false);
    expect(
      shouldFailOnRequest({
        method: "GET",
        resourceType: "fetch",
        url: "http://localhost:3000/favicon.ico",
      }),
    ).toBe(true);
  });

  test("characterizes failed asset responses and network failures", () => {
    expect(
      getResponseDiagnostic({
        method: "GET",
        resourceType: "image",
        status: 404,
        url: "http://localhost:3000/icons/missing.svg",
      }),
    ).toEqual({
      text: "GET http://localhost:3000/icons/missing.svg returned 404",
      type: "response.image",
    });
    expect(
      getResponseDiagnostic({
        method: "GET",
        resourceType: "xhr",
        status: 500,
        url: "http://localhost:3000/api/status",
      }),
    ).toBeNull();
    expect(
      getRequestFailedDiagnostic({
        failureText: "net::ERR_FAILED",
        method: "GET",
        resourceType: "stylesheet",
        url: "http://localhost:3000/app.css",
      }),
    ).toEqual({
      text: "GET http://localhost:3000/app.css failed: net::ERR_FAILED",
      type: "requestfailed.stylesheet",
    });

    expect(
      getRequestFailedDiagnostic({
        failureText: "net::ERR_ABORTED",
        method: "GET",
        resourceType: "image",
        url: "http://localhost:3000/icons/Gomoku.svg",
      }),
    ).toBeNull();
  });

  test("formats diagnostics with optional source locations and page errors", () => {
    expect(
      formatDiagnostic({
        location: {
          columnNumber: 9,
          lineNumber: 12,
          url: "http://localhost:3000/page.js",
        },
        text: "Hydration failed",
        type: "console.error",
      }),
    ).toBe("[console.error] at http://localhost:3000/page.js:12:9 Hydration failed");

    const error = new Error("boom");
    const pageErrorDiagnostic = getPageErrorDiagnostic(error);

    expect(pageErrorDiagnostic).toMatchObject({
      type: "pageerror",
    });
    expect(pageErrorDiagnostic.text).toContain("boom");
  });
});
