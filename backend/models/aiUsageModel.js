import mongoose from "mongoose";

/*
 * One AI call this server made (OpenRouter today), for the superadmin's cost view
 * (mindsets/superadmin.md). Written fire-and-forget after the call; never read on a hot path.
 * Live student sessions run inside Voxio, so their AI cost is not in here.
 */
const aiUsageSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "openrouter" },
    model: { type: String, default: "" },
    kind: { type: String, default: "other" }, // e.g. scenario_generate, scenario_edit, sim
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: null }, // as reported by the provider, when it reports one
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
aiUsageSchema.index({ createdAt: -1 });

const AiUsage = mongoose.model("AiUsage", aiUsageSchema);
export default AiUsage;
