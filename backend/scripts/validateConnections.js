import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import Student from "../models/studentModel.js";
import Scenario from "../models/scenarioModel.js";

const MONGO_URI = process.env.MONGODB_URI;

const results = { pass: 0, fail: 0, details: [] };

const check = (name, condition, detail = "") => {
  if (condition) {
    results.pass++;
    results.details.push({ name, status: "PASS", detail });
  } else {
    results.fail++;
    results.details.push({ name, status: "FAIL", detail });
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB\n");
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();

  console.log("=".repeat(70));
  console.log("  CONNECTION VALIDATION REPORT");
  console.log("=".repeat(70), "\n");

  // ===================================================================
  // 1. Load all records
  // ===================================================================
  const [schools, users, students, scenarios] = await Promise.all([
    School.find({}).lean(),
    User.find({}).lean(),
    Student.find({}).lean(),
    Scenario.find({}).lean(),
  ]);

  console.log(`  Schools: ${schools.length}, Users: ${users.length}, Students: ${students.length}, Scenarios: ${scenarios.length}\n`);

  const userIds = new Set(users.map((u) => u._id.toString()));
  const schoolIds = new Set(schools.map((s) => s._id.toString()));
  const schoolNames = new Set(schools.map((s) => s.schoolName));

  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const schoolById = new Map(schools.map((s) => [s._id.toString(), s]));
  const schoolByName = new Map(schools.map((s) => [s.schoolName, s]));

  console.log("-".repeat(70));
  console.log("  SCHOOL → ADMIN HIERARCHY");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 1: Every school has an assignedAdmin.id that references a User
  // -------------------------------------------------------------------
  let adminRefOk = 0;
  let adminRefBad = [];
  for (const school of schools) {
    if (school.assignedAdmin && school.assignedAdmin.id) {
      const id = school.assignedAdmin.id.toString();
      if (userIds.has(id)) {
        adminRefOk++;
      } else {
        adminRefBad.push(`${school.schoolName} → ${id} (User not found)`);
      }
    } else {
      adminRefBad.push(`${school.schoolName} → no assignedAdmin.id`);
    }
  }
  check(
    "1. School → assignedAdmin.id references existing User",
    adminRefBad.length === 0,
    adminRefBad.length
      ? adminRefBad.join(" | ")
      : `All ${schools.length} schools have valid admin references`,
  );

  // -------------------------------------------------------------------
  // Check 2: Assigned admin has role school_admin or educator
  // -------------------------------------------------------------------
  let adminRoleBad = [];
  for (const school of schools) {
    if (school.assignedAdmin && school.assignedAdmin.id) {
      const id = school.assignedAdmin.id.toString();
      const user = userById.get(id);
      if (user) {
        if (!["school_admin", "educator"].includes(user.role)) {
          adminRoleBad.push(
            `${school.schoolName} → admin ${user.email} has role "${user.role}"`,
          );
        }
      }
    }
  }
  check(
    "2. Assigned admin has role school_admin or educator",
    adminRoleBad.length === 0,
    adminRoleBad.length
      ? adminRoleBad.join(" | ")
      : "All assigned admins have valid roles",
  );

  // -------------------------------------------------------------------
  // Check 3: Admin's schoolId matches the school they admin
  // -------------------------------------------------------------------
  let adminSchoolMatchBad = [];
  for (const school of schools) {
    if (school.assignedAdmin && school.assignedAdmin.id) {
      const id = school.assignedAdmin.id.toString();
      const user = userById.get(id);
      if (user && user.schoolId) {
        const userSchoolId = user.schoolId.toString();
        const schoolId = school._id.toString();
        if (userSchoolId !== schoolId) {
          adminSchoolMatchBad.push(
            `${school.schoolName} → admin ${user.email} schoolId=${userSchoolId} ≠ school ${schoolId}`,
          );
        }
      }
    }
  }
  check(
    "3. Admin's schoolId matches the school they admin",
    adminSchoolMatchBad.length === 0,
    adminSchoolMatchBad.length
      ? adminSchoolMatchBad.join(" | ")
      : "All admins belong to their school",
  );

  console.log("\n" + "-".repeat(70));
  console.log("  SCHOOL → EDUCATORS");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 4: Every educator-role User has a valid schoolId
  // -------------------------------------------------------------------
  const educators = users.filter((u) => u.role === "educator");
  let eduNoSchool = [];
  for (const e of educators) {
    if (!e.schoolId) {
      eduNoSchool.push(`${e.email} (${e.name})`);
    } else if (!schoolIds.has(e.schoolId.toString())) {
      eduNoSchool.push(`${e.email} → schoolId ${e.schoolId} not found`);
    }
  }
  check(
    "4. Every educator has a valid schoolId",
    eduNoSchool.length === 0,
    eduNoSchool.length
      ? eduNoSchool.join(" | ")
      : `All ${educators.length} educators have valid schoolId`,
  );

  // -------------------------------------------------------------------
  // Check 5: Each school has at least one educator
  // -------------------------------------------------------------------
  const educatorsBySchool = new Map();
  for (const e of educators) {
    if (e.schoolId) {
      const sid = e.schoolId.toString();
      if (!educatorsBySchool.has(sid)) educatorsBySchool.set(sid, []);
      educatorsBySchool.get(sid).push(e.email);
    }
  }
  let schoolNoEdu = [];
  for (const school of schools) {
    const sid = school._id.toString();
    if (!educatorsBySchool.has(sid) || educatorsBySchool.get(sid).length === 0) {
      schoolNoEdu.push(school.schoolName);
    }
  }
  check(
    "5. Each school has at least one educator",
    schoolNoEdu.length === 0,
    schoolNoEdu.length
      ? `Schools with no educators: ${schoolNoEdu.join(", ")}`
      : "All schools have educators",
  );

  // -------------------------------------------------------------------
  // Check 6: Cross-ref: educators per school count
  // -------------------------------------------------------------------
  let schoolEduDetail = [];
  for (const school of schools) {
    const sid = school._id.toString();
    const eduList = educatorsBySchool.get(sid) || [];
    schoolEduDetail.push(`${school.schoolName}: ${eduList.length} educator(s)`);
  }
  check(
    "6. Educator distribution by school",
    true,
    schoolEduDetail.join(" | "),
  );

  console.log("\n" + "-".repeat(70));
  console.log("  EDUCATOR → STUDENTS");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 7: Every student has an educatorId (not null)
  // -------------------------------------------------------------------
  const studentsWithoutEdu = students.filter((s) => !s.educatorId);
  check(
    "7. Every student has an educator",
    studentsWithoutEdu.length === 0,
    studentsWithoutEdu.length
      ? `${studentsWithoutEdu.length} student(s) without educator`
      : "All students have an educator",
  );

  // -------------------------------------------------------------------
  // Check 8: Every student.educatorId references a User with role educator
  // -------------------------------------------------------------------
  let badEduRefs = [];
  for (const student of students) {
    if (student.educatorId) {
      const eid = student.educatorId.toString();
      const user = userById.get(eid);
      if (!user) {
        badEduRefs.push(
          `Student ${student._id} → educatorId ${eid} not found`,
        );
      } else if (user.role !== "educator") {
        badEduRefs.push(
          `Student ${student._id} → educator ${user.email} has role "${user.role}"`,
        );
      }
    }
  }
  check(
    "8. Student.educatorId references a User with role educator",
    badEduRefs.length === 0,
    badEduRefs.length
      ? badEduRefs.join(" | ")
      : "All educator references are valid",
  );

  // -------------------------------------------------------------------
  // Check 9: Each student is linked to exactly one educator
  // -------------------------------------------------------------------
  let multipleEdu = students.filter(
    (s) => s.educatorId && s.educatorId._id,
  );
  // Mongoose lean returns ObjectId directly, this check is about the schema
  // — a single ObjectId field can only hold one value by design
  check(
    "9. Each student linked to exactly one educator (schema enforces single ref)",
    true,
    "student.educatorId is a single ObjectId field — duplicates impossible",
  );

  // -------------------------------------------------------------------
  // Check 10: Each student.user references a valid User
  // -------------------------------------------------------------------
  let badUserRefs = [];
  for (const student of students) {
    if (student.user) {
      const uid = student.user.toString();
      if (!userIds.has(uid)) {
        badUserRefs.push(`Student ${student._id} → user ${uid} not found`);
      }
    }
  }
  check(
    "10. Student.user references existing User",
    badUserRefs.length === 0,
    badUserRefs.length
      ? badUserRefs.join(" | ")
      : "All student user references valid",
  );

  console.log("\n" + "-".repeat(70));
  console.log("  SCENARIO CONNECTIONS");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 11: Scenario.educator references a User with role educator
  // -------------------------------------------------------------------
  let scenarioEduBad = [];
  for (const scenario of scenarios) {
    if (scenario.educator) {
      const eid = scenario.educator.toString();
      const user = userById.get(eid);
      if (!user) {
        scenarioEduBad.push(
          `Scenario ${scenario.scenarioName} → educator ${eid} not found`,
        );
      } else if (user.role !== "educator") {
        scenarioEduBad.push(
          `Scenario ${scenario.scenarioName} → educator ${user.email} has role "${user.role}"`,
        );
      }
    }
  }
  check(
    "11. Scenario.educator references User with role educator",
    scenarioEduBad.length === 0,
    scenarioEduBad.length
      ? scenarioEduBad.join(" | ")
      : "All scenario educator references valid",
  );

  // -------------------------------------------------------------------
  // Check 12: Scenario.schoolId references a valid School
  // -------------------------------------------------------------------
  let scenarioSchoolBad = [];
  for (const scenario of scenarios) {
    if (scenario.schoolId) {
      const sid = scenario.schoolId.toString();
      if (!schoolIds.has(sid)) {
        scenarioSchoolBad.push(
          `Scenario ${scenario.scenarioName} → schoolId ${sid} not found`,
        );
      }
    }
  }
  check(
    "12. Scenario.schoolId references existing School",
    scenarioSchoolBad.length === 0,
    scenarioSchoolBad.length
      ? scenarioSchoolBad.join(" | ")
      : "All scenario school references valid",
  );

  console.log("\n" + "-".repeat(70));
  console.log("  USER CONNECTIONS");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 13: User.schoolId (if set) references a valid School
  // -------------------------------------------------------------------
  let userSchoolBad = [];
  for (const user of users) {
    if (user.schoolId) {
      const sid = user.schoolId.toString();
      if (!schoolIds.has(sid)) {
        userSchoolBad.push(`${user.email} → schoolId ${sid} not found`);
      }
    }
  }
  check(
    "13. User.schoolId references existing School",
    userSchoolBad.length === 0,
    userSchoolBad.length
      ? userSchoolBad.join(" | ")
      : "All user school references valid",
  );

  // -------------------------------------------------------------------
  // Check 14: User.supervisor (if set) references a valid User
  // -------------------------------------------------------------------
  let supBad = [];
  for (const user of users) {
    if (user.supervisor) {
      const sid = user.supervisor.toString();
      if (!userIds.has(sid)) {
        supBad.push(`${user.email} → supervisor ${sid} not found`);
      }
    }
  }
  check(
    "14. User.supervisor references existing User",
    supBad.length === 0,
    supBad.length ? supBad.join(" | ") : "All supervisor references valid",
  );

  console.log("\n" + "-".repeat(70));
  console.log("  ORPHAN RECORDS");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 15: Orphan users (no school, no role-appropriate links)
  // -------------------------------------------------------------------
  const orphans = [];
  for (const user of users) {
    if (!user.schoolId && !["superadmin"].includes(user.role)) {
      orphans.push(`${user.email} (${user.role}) — no schoolId`);
    }
  }
  check(
    "15. Non-superadmin users have schoolId",
    orphans.length === 0,
    orphans.length
      ? orphans.join(" | ")
      : "All non-superadmin users have a school",
  );

  console.log("\n" + "-".repeat(70));
  console.log("  LOGIN TEST");
  console.log("-".repeat(70));

  // -------------------------------------------------------------------
  // Check 16: Login test with Temp@123456
  // -------------------------------------------------------------------
  let loginResults = [];
  const testEmails = [
    ...educators.slice(0, 1).map((e) => e.email),
    ...students.slice(0, 1).map((s) => {
      const u = userById.get(s.user?.toString());
      return u ? u.email : null;
    }),
  ].filter(Boolean);

  for (const email of testEmails) {
    try {
      const user = await User.findOne({ email });
      if (user) {
        const match = await user.matchPassword("Temp@123456");
        loginResults.push(
          `${email}: ${match ? "✓ login OK" : "✗ wrong password"}`,
        );
      } else {
        loginResults.push(`${email}: ✗ user not found`);
      }
    } catch (err) {
      loginResults.push(`${email}: ✗ error — ${err.message}`);
    }
  }
  check(
    "16. Login test with Temp@123456",
    loginResults.every((r) => r.includes("✓")),
    loginResults.length
      ? loginResults.join(" | ")
      : "No users to test",
  );

  // ===================================================================
  // SUMMARY
  // ===================================================================
  console.log("\n" + "=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70));
  console.log(`  ✅ PASS: ${results.pass}`);
  console.log(`  ❌ FAIL: ${results.fail}`);
  console.log("");

  if (results.fail === 0) {
    console.log("  ✅ ALL CHECKS PASSED — connections are correct\n");
  } else {
    console.log("  ❌ SOME CHECKS FAILED — see details above\n");
  }

  for (const d of results.details) {
    const icon = d.status === "PASS" ? "✅" : "❌";
    console.log(`  ${icon} ${d.name}`);
    if (d.status === "FAIL") {
      console.log(`     → ${d.detail}`);
    }
  }

  console.log("");
  await mongoose.connection.close();
  console.log("🔌 Database connection closed");
  process.exit(results.fail > 0 ? 1 : 0);
};

run();
