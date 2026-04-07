import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      unique: true,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    grade: {
      type: String,
    },
    school: {
      type: String,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    assignedScenarios: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Scenario",
      },
    ],
  },
  { timestamps: true },
);

const Student = mongoose.model("Student", studentSchema);

export default Student;
