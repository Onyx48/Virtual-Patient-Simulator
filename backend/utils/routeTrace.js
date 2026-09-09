/*
 * Per-request tracing for the routes that are hard to debug from the outside:
 * scenario create/edit and the reasoning coach.
 *
 * Why a helper rather than console.log at each site: every line for one request
 * has to carry the same id and a running elapsed time, or a concurrent log is
 * just interleaved fragments — with several educators saving scenarios and the
 * simulator calling the coach for different students, there is otherwise no way
 * to tell which "saved" belongs to which request. The counter also makes a
 * missing step obvious: if step 4 is followed by nothing, the handler died there.
 */

const SECRET_KEY_PATTERN = /(api[-_]?key|token|password|secret|authorization|cookie|jwe|jwt)/i;

/*
 * Long enough to hold a whole scenario prompt and a consultation transcript,
 * since a truncated body is exactly the thing you needed to see. Past this the
 * log costs more than it tells you.
 */
const MAX_VALUE_CHARS = 20000;

/**
 * Deep copy with secrets masked and long strings marked with their true length.
 *
 * Masking is by key name, not value, so a flow key or JWT cannot reach the log
 * through a field nobody thought about. The last 4 characters are kept as a
 * fingerprint — enough to tell which key was sent — but only for a value long
 * enough that 4 characters are not most of it, or the hint is the secret.
 */
const fingerprint = (text) =>
  text.length > 12 ? `[redacted ${text.length} chars, ends …${text.slice(-4)}]` : `[redacted ${text.length} chars]`;

export const redact = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > 8) return "[too deep]";

  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    // A Mongoose document logs as its plain fields, not its internals.
    const source = typeof value.toObject === "function" ? value.toObject() : value;
    const out = {};
    for (const [key, item] of Object.entries(source)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        const text = String(item ?? "");
        out[key] = text ? fingerprint(text) : "(empty)";
        continue;
      }
      out[key] = redact(item, depth + 1);
    }
    return out;
  }

  if (typeof value === "string" && value.length > MAX_VALUE_CHARS) {
    return `${value.slice(0, MAX_VALUE_CHARS)}… [+${value.length - MAX_VALUE_CHARS} chars]`;
  }

  return value;
};

/** One-line JSON, since a pretty-printed body is unreadable in a pm2 log. */
export const dump = (value) => {
  try {
    return JSON.stringify(redact(value));
  } catch (err) {
    // Circular or otherwise unserialisable: say so instead of throwing inside a
    // log call and taking the request down with it.
    return `[unserialisable: ${err.message}]`;
  }
};

/*
 * Short and random rather than sequential — it only has to be unique among the
 * requests in flight, and a counter would need shared state across workers.
 */
const newTraceId = () => Math.random().toString(36).slice(2, 8);

/**
 * Open a trace for one request.
 *
 * Logs the request line, headers worth having, and the full body immediately, so
 * a handler that throws before its first step still leaves the input behind.
 *
 * @param {string} tag  Route name as it should appear in the log, e.g. "add-scenario".
 * @param {import('express').Request} req
 */
export const startTrace = (tag, req) => {
  const id = newTraceId();
  const startedAt = Date.now();
  let step = 0;

  const prefix = () => `[${tag} ${id}]`;
  const elapsed = () => `${Date.now() - startedAt}ms`;

  console.log(
    `${prefix()} ── ${req.method} ${req.originalUrl} from ${req.ip} ` +
      `content-type=${req.get("content-type") || "(none)"} ` +
      `content-length=${req.get("content-length") || "(none)"} ` +
      `user=${req.user?._id || "(unauthenticated)"} role=${req.user?.role || "-"} ` +
      `school=${req.user?.schoolId?._id || req.user?.schoolId || "-"}`,
  );
  console.log(`${prefix()} params=${dump(req.params)} query=${dump(req.query)}`);
  console.log(`${prefix()} body=${dump(req.body)}`);

  /*
   * req.scope is set by checkAccess and is what every handler is supposed to
   * merge into its Mongo query. It is invisible in the request, so a scoping bug
   * is undiagnosable without printing it.
   */
  if (req.scope) console.log(`${prefix()} scope=${dump(req.scope)}`);

  return {
    id,

    /** A numbered step with optional structured detail. */
    log(message, detail) {
      step += 1;
      console.log(
        `${prefix()} ${step}. ${message}` +
          `${detail === undefined ? "" : ` ${typeof detail === "string" ? detail : dump(detail)}`} ` +
          `(+${elapsed()})`,
      );
    },

    /** Something the request survived but somebody should see. */
    warn(message, detail) {
      console.warn(
        `${prefix()} ! ${message}` +
          `${detail === undefined ? "" : ` ${typeof detail === "string" ? detail : dump(detail)}`} ` +
          `(+${elapsed()})`,
      );
    },

    /**
     * The exact response, logged next to the request that produced it.
     *
     * Call this instead of res.json() so the two can never disagree — a separate
     * log line drifts from the payload the moment either is edited.
     */
    send(res, status, payload) {
      console.log(
        `${prefix()} ── ${status} in ${elapsed()} response=${dump(payload)}`,
      );
      return res.status(status).json(payload);
    },

    /** Failure detail the stack alone does not carry. */
    fail(err) {
      console.error(
        `${prefix()} ✗ FAILED after ${elapsed()} at step ${step}: ` +
          `${err.name}: ${err.message} ` +
          `code=${err.code ?? "-"} status=${err.status ?? err.statusCode ?? "-"} ` +
          `keyValue=${err.keyValue ? dump(err.keyValue) : "-"} ` +
          `validation=${err.errors ? dump(Object.keys(err.errors)) : "-"}`,
      );
      console.error(err.stack);
    },
  };
};
