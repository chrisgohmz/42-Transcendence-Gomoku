type DiagnosticLocation = {
  columnNumber?: number;
  lineNumber?: number;
  url?: string;
};

export type BrowserDiagnostic = {
  location?: DiagnosticLocation;
  text: string;
  type: string;
};

type ConsoleDiagnosticInput = {
  location?: DiagnosticLocation;
  text: string;
  type: string;
};

type RequestDiagnosticInput = {
  failureText?: string;
  method: string;
  resourceType: string;
  url: string;
};

type ResponseDiagnosticInput = RequestDiagnosticInput & {
  status: number;
};

const guardedResourceTypes = new Set([
  "document",
  "font",
  "image",
  "manifest",
  "script",
  "stylesheet",
]);

export function formatDiagnostic(diagnostic: BrowserDiagnostic) {
  const location = diagnostic.location;
  const source =
    location && (location.url || location.lineNumber || location.columnNumber)
      ? ` at ${location.url}:${location.lineNumber}:${location.columnNumber}`
      : "";

  return `[${diagnostic.type}]${source} ${diagnostic.text}`;
}

export function getConsoleDiagnostic({
  location,
  text,
  type,
}: ConsoleDiagnosticInput): BrowserDiagnostic | null {
  if (type !== "warning" && type !== "error") {
    return null;
  }

  return {
    location,
    text,
    type: `console.${type}`,
  };
}

export function getPageErrorDiagnostic(error: Error): BrowserDiagnostic {
  return {
    text: error.stack ?? error.message,
    type: "pageerror",
  };
}

export function getRequestFailedDiagnostic(
  request: RequestDiagnosticInput,
): BrowserDiagnostic | null {
  if (!shouldFailOnRequest(request) || isRequestAbort(request.failureText)) {
    return null;
  }

  return {
    text: `${request.method} ${request.url} failed: ${
      request.failureText ?? "unknown network failure"
    }`,
    type: `requestfailed.${request.resourceType}`,
  };
}

export function getResponseDiagnostic(response: ResponseDiagnosticInput): BrowserDiagnostic | null {
  if (response.status < 400 || !shouldFailOnRequest(response)) {
    return null;
  }

  return {
    text: `${response.method} ${response.url} returned ${response.status}`,
    type: `response.${response.resourceType}`,
  };
}

export function shouldFailOnRequest({ resourceType, url }: RequestDiagnosticInput) {
  if (resourceType === "fetch" || resourceType === "xhr") {
    return new URL(url).pathname === "/favicon.ico";
  }

  return guardedResourceTypes.has(resourceType) || new URL(url).pathname === "/favicon.ico";
}

function isRequestAbort(failureText: string | undefined) {
  return failureText === "net::ERR_ABORTED" || failureText === "NS_BINDING_ABORTED";
}
