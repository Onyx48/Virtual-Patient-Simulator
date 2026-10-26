/**
 * Server-side PostHog events. Off until POSTHOG_KEY is set; capture() is then
 * a no-op, so callers never need to check.
 */
import { PostHog } from "posthog-node";

const client = process.env.POSTHOG_KEY
  ? new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    })
  : null;

export const capture = (distinctId, event, properties = {}) => {
  if (!client || !distinctId) return;
  client.capture({
    distinctId: String(distinctId),
    event,
    properties: { app_env: process.env.APP_ENV || "development", ...properties },
  });
};

// Flush queued events on shutdown so the last few are not lost.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    if (client) await client.shutdown().catch(() => {});
    process.exit(0);
  });
}
