import User from "../models/userModel.js";

// Gmail-family domains are the only ones validator's normalizeEmail() rewrote
// (it strips dots and +tags from the local part). Kept here only to find users
// whose address was mangled on the way in.
const GMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
]);

/** Trim + lowercase. This is the canonical form new addresses are stored in. */
export const canonicalizeEmail = (email) => String(email || "").trim().toLowerCase();

/**
 * Reproduces what `body("email").normalizeEmail()` used to do, so accounts that
 * were created through a route that normalized (POST /api/auth/register) are
 * still findable now that the auth routes no longer mangle the input.
 * Returns null when normalization would not change anything.
 */
export const legacyNormalizedEmail = (email) => {
  const canonical = canonicalizeEmail(email);
  const [local, domain] = canonical.split("@");
  if (!domain || !GMAIL_DOMAINS.has(domain)) return null;
  const stripped = local.split("+")[0].replace(/\./g, "");
  const normalized = `${stripped}@${domain}`;
  return normalized === canonical ? null : normalized;
};

/**
 * Look a user up by email, tolerating both storage forms.
 *
 * Addresses reached the users collection two different ways: verbatim (POST
 * /api/users, the CSV importer) and gmail-normalized (POST /api/auth/register).
 * Matching only the normalized form locked every verbatim gmail address with a
 * dot in it out of login entirely, so try the address as typed first and fall
 * back to the normalized form.
 *
 * @param {string} email      raw address from the request body
 * @param {string} [select]   extra projection, e.g. "+password"
 */
export const findUserByEmail = async (email, select) => {
  const canonical = canonicalizeEmail(email);

  const build = (value) => {
    const q = User.findOne({ email: value });
    return select ? q.select(select) : q;
  };

  const user = await build(canonical);
  if (user) return user;

  const legacy = legacyNormalizedEmail(canonical);
  return legacy ? build(legacy) : null;
};
