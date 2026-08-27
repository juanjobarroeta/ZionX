/**
 * Sentry for the backend — loaded before anything else (see first line of
 * index.js) so the SDK can instrument http/express as they are required.
 *
 * Init is gated on SENTRY_DSN: local dev without the variable runs exactly as
 * before, no SDK activity at all.
 */
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || 'production',
    // Errors only; tracing would eat quota on a 60s scheduler loop.
    tracesSampleRate: 0,
  });
  console.log('🛡  Sentry backend activo (' + (process.env.SENTRY_ENVIRONMENT || 'production') + ')');
}

module.exports = Sentry;
