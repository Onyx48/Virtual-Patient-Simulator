import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
    },
    /*
     * Educator notes on the whole group (after ci/internal-shortlisting's class notes): named
     * authors, newest last. Not shown to students. Optional, so old groups need no migration.
     */
    // Code a student types to join this class (6 unambiguous characters). Absent = joining off.
    joinCode: { type: String, default: undefined, uppercase: true, trim: true, index: { unique: true, sparse: true } },
    notes: {
      type: [
        new mongoose.Schema(
          {
            text: { type: String, required: true, maxlength: 4000 },
            author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            authorName: { type: String, default: "" },
          },
          { timestamps: true },
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true },
);

// Indexes for the scoped lists and lookups (added for scale; additive, built at startup).
groupSchema.index({ educatorId: 1 });
groupSchema.index({ schoolId: 1 });
const Group = mongoose.model("Group", groupSchema);
export default Group;
