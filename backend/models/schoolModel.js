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
