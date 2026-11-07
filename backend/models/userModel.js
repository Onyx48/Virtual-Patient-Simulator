// WHOLE_PROJECT/models/userModel.js
import mongoose from "mongoose";
import "./refreshTokenModel.js";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /.+\@.+\..+/,
        "Please fill a valid email address. Example: user@example.com",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    role: {
      type: String,
      // We enforce lowercase roles here
      enum: {
        values: ["student", "educator", "school_admin", "superadmin"],
        message:
          "{VALUE} is not a supported role. Must be student, educator, school_admin, or superadmin.",
      },
      required: [true, "User role is required"],
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: false,
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    department: {
      type: String,
      enum: {
        values: ["Science", "History", "English", "Mathematics"],
        message:
          "{VALUE} is not a valid department. Must be Science, History, English, or Mathematics.",
      },
    },
    phoneNumber: {
      type: String,
      trim: true,
      required: false,
    },
    profilePicture: {
      type: String,
      trim: true,
      required: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    /*
     * When the welcome email carrying this account's credentials was last
     * accepted by SES. Null means nobody has ever been told how to log in —
     * either mail was unconfigured or the send failed. Together with
     * `lastLoginAt` this drives the invite status shown on the roster, so an
     * account that silently never received credentials is visible instead of
     * looking identical to one that did.
     */
    credentialsSentAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  // Remembered for post-save: a new password logs the account out everywhere.
  this.$locals.passwordChanged = !this.isNew;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Every password change or reset (self-service, OTP reset, admin resend) cancels all
// refresh tokens, so other devices have to log in again with the new password.
userSchema.post("save", async function () {
  if (!this.$locals.passwordChanged) return;
  this.$locals.passwordChanged = false;
  await mongoose.model("RefreshToken").deleteMany({ user: this._id });
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    return false;
  }
};

const User = mongoose.model("User", userSchema);
export default User;
