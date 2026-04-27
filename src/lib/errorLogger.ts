/**
 * Lightweight frontend error logger.
 * Logs to console with structured info; can be extended to ship errors
 * to a remote service later (Sentry, Logflare, etc.).
 */

type ErrorContext = Record<string, unknown>;

export function logError(
  source: string,
  error: unknown,
  context: ErrorContext = {}
) {
  const payload = {
    source,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
    ...context,
  };
  // eslint-disable-next-line no-console
  console.error("[app-error]", payload);
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    logError("window_error", event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logError("unhandled_promise_rejection", event.reason);
  });
}
