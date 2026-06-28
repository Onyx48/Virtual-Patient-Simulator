import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import Student from "../models/studentModel.js";

const MONGO_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB\n");
};

const run = async () => {
  await connectDB();

  console.log("=".repeat(60));
  console.log("  REPAIR CONNECTIONS — Link existing records only");
  console.log("=".repeat(60));

  // ============================================================
  // STEP 1: Populate School.assignedAdmin from existing users
  // ============================================================
  console.log("\n📌 STEP 1: Assign school admins from existing users");
  const schools = await School.find({}).lean();
  let adminCount = 0;
  let noAdminCount = 0;

  for (const school of schools) {
    if (school.assignedAdmin?.id) {
      continue;
    }

    let admin = await User.findOne({ role: "school_admin", schoolId: school._id });
    if (!admin) {
      admin = await User.findOne({ role: "educator", schoolId: school._id });
    }

    if (admin) {
      await School.findByIdAndUpdate(school._id, {
        assignedAdmin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
        },
      });
      adminCount++;
      console.log(`  ✓ ${school.schoolName} ← admin: ${admin.email} (${admin.role})`);
    } else {
      noAdminCount++;
      console.log(`  ⚠ ${school.schoolName} — no admin found`);
    }
  }
  console.log(`  → Done: ${adminCount} assigned, ${noAdminCount} still without admin`);

  // ============================================================
  // STEP 2: Link educators without schoolId
  // ============================================================
  console.log("\n📌 STEP 2: Link educators without schoolId");
  const allSchools = await School.find({}).lean();
  const educators = await User.find({ role: "educator", schoolId: null });
  let linkedCount = 0;
  let stillOrphaned = [];

  for (const educator of educators) {
    let match = null;

    const adminUser = await User.findOne({ role: "school_admin", email: educator.email });
    if (adminUser && adminUser.schoolId) {
      match = allSchools.find(s => s._id.toString() === adminUser.schoolId.toString());
      if (match) console.log(`    → via school_admin ${educator.email}`);
    }

    if (!match) {
      match = allSchools.find(s => s.email === educator.email);
    }

    if (!match) {
      match = allSchools.find(s =>
        educator.name.toLowerCase().includes(s.schoolName.toLowerCase()) ||
        educator.email.toLowerCase().includes(s.schoolName.toLowerCase())
      );
    }

    if (match) {
      educator.schoolId = match._id;
      await educator.save();
      linkedCount++;
      console.log(`  ✓ ${educator.email} → ${match.schoolName}`);
    } else {
      stillOrphaned.push(educator.email);
    }
  }

  if (stillOrphaned.length > 0) {
    console.log(`  ⚠ Still orphaned: ${stillOrphaned.join(", ")}`);
  }
  console.log(`  → Done: ${linkedCount} linked, ${stillOrphaned.length} still orphaned`);

  // ============================================================
  // STEP 3: Propagate schoolId from educator to student's User
  // ============================================================
  console.log("\n📌 STEP 3: Propagate schoolId to student Users via educator");
  const students = await Student.find({ educatorId: { $ne: null } }).lean();
  let propCount = 0;
  let skipCount = 0;

  for (const student of students) {
    const studentUser = await User.findById(student.user);
    if (!studentUser || studentUser.schoolId) {
      skipCount++;
      continue;
    }

    const educator = await User.findById(student.educatorId);
    if (educator && educator.schoolId) {
      studentUser.schoolId = educator.schoolId;
      await studentUser.save();
      propCount++;
      console.log(`  ✓ ${studentUser.email} → schoolId from educator ${educator.email}`);
    } else {
      skipCount++;
    }
  }
  console.log(`  → Done: ${propCount} updated, ${skipCount} skipped (already set or no educator schoolId)`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("  REPAIR COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Admins assigned:  ${adminCount}`);
  console.log(`  Educators linked: ${linkedCount}`);
  console.log(`  SchoolIds set:    ${propCount}`);
  console.log("");

  await mongoose.connection.close();
  console.log("🔌 Database connection closed");
  process.exit(0);
};

run();
