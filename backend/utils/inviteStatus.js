/*
 * Invite status is derived, never stored as its own field — a stored status is
 * one more thing to keep in sync with the two timestamps that actually decide
 * it, and it would go stale the moment a send or a login was not mirrored into
 * it.
 *
 *   active   already logged in at least once; the credentials demonstrably work
 *   invited  credentials were emailed, but the account has never been used
 *   pending  nobody has ever been sent a way to log in
 *
 * `pending` is the one that matters: it is the state an account lands in when
 * SES is unconfigured or the send fails, which used to be invisible because the
 * create request still returned success.
 */
export const inviteStatusOf = (user) => {
  if (user?.lastLoginAt) return "active";
  if (user?.credentialsSentAt) return "invited";
  return "pending";
};

export const INVITE_STATUSES = ["active", "invited", "pending"];
