import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

/**
 * Error tracking (Sentry) and product analytics (PostHog).
 *
 * Both stay off until their keys are set, so nothing is sent from a build that
 * has no keys. VITE_* values are baked in at build time: set them in .env (or
 * as Docker build args) before `pnpm build`.
 *
 *   VITE_SENTRY_DSN        Sentry project DSN
 *   VITE_POSTHOG_KEY       PostHog project API key
 *   VITE_POSTHOG_HOST      defaults to https://us.i.posthog.com
 *   VITE_APP_ENV           tags events, e.g. development / staging / production
 */
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
const APP_ENV = import.meta.env.VITE_APP_ENV || import.meta.env.MODE;

export function initMonitoring() {
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: APP_ENV,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.1,
    });
  }
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: "history_change",
    });
    posthog.register({ app_env: APP_ENV });
  }
}

/** Attach the logged-in user to later events, or clear it on logout. */
export function identifyUser(user) {
  if (user?._id) {
    const traits = { role: user.role, schoolId: user.schoolId?._id || user.schoolId || null };
    if (SENTRY_DSN) Sentry.setUser({ id: user._id, ...traits });
    if (POSTHOG_KEY) posthog.identify(user._id, traits);
  } else {
    if (SENTRY_DSN) Sentry.setUser(null);
    if (POSTHOG_KEY) posthog.reset();
  }
}

export { Sentry, posthog };
