/**
 * Which mode the API is running in.
 *
 * APP_ENV is the explicit switch; NODE_ENV is honoured as a fallback so an
 * existing `NODE_ENV=production` deployment keeps behaving as production
 * without needing a new variable. Anything other than production/prod is dev.
 */
export const APP_ENV = (
  process.env.APP_ENV ||
  process.env.NODE_ENV ||
  "development"
)
  .trim()
  .toLowerCase();

export const isProd = APP_ENV === "production" || APP_ENV === "prod";
export const isDev = !isProd;

/**
 * Message safe to send to a client.
 *
 * In dev you get the real reason (which variable is missing, what SES said).
 * In production that detail is internal — the caller gets `fallback` and the
 * specifics go to the server log only, so misconfiguration and infrastructure
 * errors are not disclosed to whoever is poking at the API.
 *
 * @param {Error}  err       the underlying error
 * @param {string} fallback  generic, user-facing wording used in production
 */
export const publicMessage = (err, fallback) => {
  if (isProd) return fallback;
  return err?.message || fallback;
};
