import mongoose from "mongoose";

/*
 * One conversation with the in-app assistant. Owned by one user; nobody else reads it.
 * `actions` on an assistant message records what was proposed and, once confirmed, what ran.
 */
const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    executed: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: true },
);

const assistantChatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String },
    title: { type: String, default: "New chat" },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("AssistantChat", assistantChatSchema);
