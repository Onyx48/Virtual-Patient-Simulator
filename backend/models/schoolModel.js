// WHOLE_PROJECT/models/schoolModel.js
import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: [true, "School Name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },
    subscription: {
      type: String,
      enum: ["Subscription (1 Year)", "Subscription (6 Months)", "Expired"],
      default: "Subscription (1 Year)",
    },
    subscriptionType: {
      type: String,
      enum: ["Premium", "Basic", "Free"],
      default: "Premium",
    },
    startDate: {
      type: Date,
      required: [true, "Start Date is required"],
    },
    expireDate: {
      type: Date,
      required: [true, "Expire Date is required"],
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Pending"],
      default: "Active",
    },
    // Pre-selected on this school's new scenarios (utils/profession.js).
    defaultProfession: {
      type: String,
      enum: ["physiotherapy", "occupational_therapy"],
      default: "physiotherapy",
    },
    permissions: {
      type: String,
      enum: ["Read Only", "Write Only", "Both"],
      default: "Read Only",
    },
    timeSpent: {
      type: String,
      default: "0h",
    },
    assignedAdmin: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    // Whether this org's admin has been sent their login credentials. Separate
    // from `status` above, which is about the subscription.
    inviteStatus: {
      type: String,
      enum: ["pending", "invited"],
      default: "pending",
    },
    inviteSentAt: { type: Date, default: null },
    // Vendor notes on the school ("renewal call booked 12 Dec"). Superadmin only. Optional.
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
      select: false,
    },
    inviteSentTo: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "schools",
  },
);

schoolSchema.path("expireDate").validate(function (value) {
  if (!this.startDate || !value) return true;
  return value >= this.startDate;
}, "End Date must be on or after Start Date.");

const School = mongoose.model("School", schoolSchema);
export default School;
