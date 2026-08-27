/**
 * Sentry — the only net that catches a broken render.
 *
 * A green Vite build does not prove a page renders: an undefined JSX component
 * is a runtime ReferenceError in the browser, invisible to the build, to
 * Railway logs, and to HTTP monitoring (the shell still returns 200). This is
 * the net for exactly that class of failure.
 *
 * The DSN is a public client key (it can only ingest events, not read them),
 * so shipping it in the bundle is by design — same as any Sentry browser app.
 */
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ||
    "https://56891527b9dda8eef53cf32e15f186f5@o4511923699712000.ingest.us.sentry.io/4511984205234176",
  environment: import.meta.env.MODE,
  // Errors only — no session replay, no tracing. Quota goes to what pages you.
  tracesSampleRate: 0,
  // Dev noise stays local; production is what we need eyes on.
  enabled: import.meta.env.PROD,
});
