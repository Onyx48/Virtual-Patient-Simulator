import mongoose from "mongoose";

/**
 * One row per browser login. Only a SHA-256 hash of the token is stored, so a database
 * leak does not hand out sessions. Each refresh rotates the token: the old row is marked
 * revoked and points at its replacement. Expired rows are removed by the TTL index.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null }, // tokenHash of the next token
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RefreshToken || mongoose.model("RefreshToken", refreshTokenSchema);
