/**
 * The password rule for every password a person chooses: signup, reset,
 * change-password and an admin typing one in. Generated passwords
 * (crypto.randomBytes(8) -> 16 hex chars) already satisfy it.
 *
 * ISO 27001 A.5.17 / IRL #20 evidence: this file is the configured parameter.
 *
 *   - 12 to 128 characters
 *   - at least one letter and one digit
 *   - not a common password, and not containing the account's email name
 *
 * Login lockout after repeated failures lives in routes/authRoutes.js
 * (MAX_LOGIN_FAIL_ATTEMPTS, LOCKOUT_DURATION_MINUTES).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULE_TEXT =
  `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters, ` +
  "contain at least one letter and one number, and not be a common password.";

const COMMON = new Set([
  "password1234", "password12345", "password123456", "passw0rd1234", "123456789012",
  "qwerty123456", "qwertyuiop12", "iloveyou1234", "admin1234567", "welcome12345",
  "letmein12345", "abc123456789", "123456abcdef", "changeme1234", "password@123",
]);

/** null when acceptable, else the reason it is not. */
export const passwordProblem = (password, email = "") => {
  const p = String(password ?? "");
  if (p.length < PASSWORD_MIN_LENGTH || p.length > PASSWORD_MAX_LENGTH) return PASSWORD_RULE_TEXT;
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return PASSWORD_RULE_TEXT;
  if (COMMON.has(p.toLowerCase())) return "That password is too common. Choose another.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && p.toLowerCase().includes(local)) {
    return "Password must not contain your email name.";
  }
  return null;
};

/** express-validator custom check: body("password").custom(passwordValidator("email")) */
export const passwordValidator = (emailField = "email") => (value, { req }) => {
  const problem = passwordProblem(value, req.body?.[emailField] || req.user?.email);
  if (problem) throw new Error(problem);
  return true;
};
