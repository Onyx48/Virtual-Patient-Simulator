import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import Student from "../models/studentModel.js";
import Scenario from "../models/scenarioModel.js";

const MONGO_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB");
};

const run = async () => {
  await connectDB();

  const [schools, users, students, scenarios] = await Promise.all([
    School.find({}).lean(),
    User.find({}).lean(),
    Student.find({}).lean(),
    Scenario.find({}).lean(),
  ]);

  const userIds = new Set(users.map((u) => u._id.toString()));
  const schoolIds = new Set(schools.map((s) => s._id.toString()));
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const schoolById = new Map(schools.map((s) => [s._id.toString(), s]));

  // ================================================================
  // CATEGORY 1: Students without educator
  // ================================================================
  const studentsNoEdu = students
    .filter((s) => !s.educatorId)
    .map((s) => {
      const u = s.user ? userById.get(s.user.toString()) : null;
      return {
        _id: s._id.toString(),
        email: u ? u.email : "UNKNOWN",
        name: u ? u.name : "UNKNOWN",
        group: s.school || "",
        grade: s.grade || "",
        enrollmentDate: s.enrollmentDate,
      };
    });

  // ================================================================
  // CATEGORY 2: Students with invalid educator reference
  // ================================================================
  const studentsBadEdu = [];
  for (const s of students) {
    if (s.educatorId) {
      const eid = s.educatorId.toString();
      const eduUser = userById.get(eid);
      const studentUser = s.user ? userById.get(s.user.toString()) : null;
      if (!eduUser) {
        studentsBadEdu.push({
          _id: s._id.toString(),
          email: studentUser ? studentUser.email : "UNKNOWN",
          educatorId: eid,
          problem: "Educator user not found in database",
        });
      } else if (eduUser.role !== "educator") {
        studentsBadEdu.push({
          _id: s._id.toString(),
          email: studentUser ? studentUser.email : "UNKNOWN",
          educatorId: eid,
          educatorEmail: eduUser.email,
          educatorRole: eduUser.role,
          problem: `Educator has role "${eduUser.role}" instead of "educator"`,
        });
      }
    }
  }

  // ================================================================
  // CATEGORY 3: Educators without schoolId
  // ================================================================
  const educatorsNoSchool = users
    .filter((u) => u.role === "educator" && !u.schoolId)
    .map((u) => ({
      _id: u._id.toString(),
      email: u.email,
      name: u.name,
      department: u.department || "",
    }));

  // ================================================================
  // CATEGORY 4: Educators with invalid schoolId
  // ================================================================
  const educatorsBadSchool = [];
  for (const u of users) {
    if (u.role === "educator" && u.schoolId) {
      const sid = u.schoolId.toString();
      if (!schoolIds.has(sid)) {
        educatorsBadSchool.push({
          _id: u._id.toString(),
          email: u.email,
          name: u.name,
          schoolId: sid,
          problem: "School not found",
        });
      }
    }
  }

  // ================================================================
  // CATEGORY 5: Schools without assignedAdmin
  // ================================================================
  const schoolsNoAdmin = schools
    .filter((s) => !s.assignedAdmin || !s.assignedAdmin.id)
    .map((s) => ({
      _id: s._id.toString(),
      schoolName: s.schoolName,
      email: s.email,
    }));

  // ================================================================
  // CATEGORY 6: Schools with invalid assignedAdmin
  // ================================================================
  const schoolsBadAdmin = [];
  for (const s of schools) {
    if (s.assignedAdmin && s.assignedAdmin.id) {
      const aid = s.assignedAdmin.id.toString();
      const adminUser = userById.get(aid);
      if (!adminUser) {
        schoolsBadAdmin.push({
          _id: s._id.toString(),
          schoolName: s.schoolName,
          assignedAdminId: aid,
          problem: "Admin user not found",
        });
      } else if (!["school_admin", "educator"].includes(adminUser.role)) {
        schoolsBadAdmin.push({
          _id: s._id.toString(),
          schoolName: s.schoolName,
          assignedAdminId: aid,
          adminEmail: adminUser.email,
          adminRole: adminUser.role,
          problem: `Admin has role "${adminUser.role}"`,
        });
      }
    }
  }

  // ================================================================
  // CATEGORY 7: Schools without any educator
  // ================================================================
  const educatorsBySchool = new Map();
  for (const u of users) {
    if (u.role === "educator" && u.schoolId) {
      const sid = u.schoolId.toString();
      if (!educatorsBySchool.has(sid)) educatorsBySchool.set(sid, []);
      educatorsBySchool.get(sid).push(u.email);
    }
  }
  const schoolsNoEdu = schools
    .filter((s) => {
      const sid = s._id.toString();
      return !educatorsBySchool.has(sid) || educatorsBySchool.get(sid).length === 0;
    })
    .map((s) => ({
      _id: s._id.toString(),
      schoolName: s.schoolName,
      email: s.email,
    }));

  // ================================================================
  // CATEGORY 8: Users (non-superadmin) without schoolId
  // ================================================================
  const usersNoSchool = users
    .filter((u) => !u.schoolId && u.role !== "superadmin")
    .map((u) => ({
      _id: u._id.toString(),
      email: u.email,
      name: u.name,
      role: u.role,
    }));

  // ================================================================
  // CATEGORY 9: Students without schoolId on their User record
  // ================================================================
  const studentUsersNoSchool = [];
  for (const s of students) {
    if (s.user) {
      const uid = s.user.toString();
      const u = userById.get(uid);
      if (u && !u.schoolId) {
        studentUsersNoSchool.push({
          studentId: s._id.toString(),
          email: u.email,
          name: u.name,
          group: s.school || "",
        });
      }
    }
  }

  // ================================================================
  // CATEGORY 10: Users with invalid schoolId
  // ================================================================
  const usersBadSchool = [];
  for (const u of users) {
    if (u.schoolId) {
      const sid = u.schoolId.toString();
      if (!schoolIds.has(sid)) {
        usersBadSchool.push({
          _id: u._id.toString(),
          email: u.email,
          name: u.name,
          role: u.role,
          schoolId: sid,
        });
      }
    }
  }

  // ================================================================
  // CATEGORY 11: Login test failures
  // ================================================================
  const loginFailures = [];
  const testers = users.filter((u) =>
    ["educator", "student"].includes(u.role),
  );
  for (const u of testers.slice(0, 5)) {
    try {
      const user = await User.findById(u._id);
      if (user) {
        const match = await user.matchPassword("Temp@123456");
        if (!match) {
          loginFailures.push({
            _id: u._id.toString(),
            email: u.email,
            name: u.name,
            role: u.role,
            problem: "Password does not match Temp@123456",
          });
        }
      }
    } catch (err) {
      loginFailures.push({
        _id: u._id.toString(),
        email: u.email,
        problem: `Error: ${err.message}`,
      });
    }
  }

  // ================================================================
  // BUILD REPORT
  // ================================================================
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSchools: schools.length,
      totalUsers: users.length,
      totalStudents: students.length,
      totalScenarios: scenarios.length,
    },
    categories: {
      studentsWithoutEducator: {
        count: studentsNoEdu.length,
        description: "Students who have no educatorId set",
        records: studentsNoEdu,
      },
      studentsWithInvalidEducator: {
        count: studentsBadEdu.length,
        description: "Students whose educatorId references a missing or wrong-role user",
        records: studentsBadEdu,
      },
      educatorsWithoutSchool: {
        count: educatorsNoSchool.length,
        description: "Educator-role users with no schoolId",
        records: educatorsNoSchool,
      },
      educatorsWithInvalidSchool: {
        count: educatorsBadSchool.length,
        description: "Educator-role users whose schoolId references a non-existent school",
        records: educatorsBadSchool,
      },
      schoolsWithoutAdmin: {
        count: schoolsNoAdmin.length,
        description: "Schools with no assignedAdmin",
        records: schoolsNoAdmin,
      },
      schoolsWithInvalidAdmin: {
        count: schoolsBadAdmin.length,
        description: "Schools whose assignedAdmin references a missing or wrong-role user",
        records: schoolsBadAdmin,
      },
      schoolsWithoutEducators: {
        count: schoolsNoEdu.length,
        description: "Schools that have zero educator-role users linked",
        records: schoolsNoEdu,
      },
      usersWithoutSchool: {
        count: usersNoSchool.length,
        description: "All non-superadmin users with no schoolId",
        records: usersNoSchool,
      },
      studentUsersWithoutSchool: {
        count: studentUsersNoSchool.length,
        description: "Student records whose linked User has no schoolId",
        records: studentUsersNoSchool,
      },
      usersWithInvalidSchool: {
        count: usersBadSchool.length,
        description: "Users whose schoolId references a non-existent school",
        records: usersBadSchool,
      },
      loginFailures: {
        count: loginFailures.length,
        description: "Users whose password does not match Temp@123456 (sample of first 5 per role)",
        records: loginFailures,
      },
    },
  };

  const outPath = path.resolve(process.cwd(), "broken-connections-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`✓ Report written to ${outPath}`);
  console.log(`  Categories:`);
  for (const [key, cat] of Object.entries(report.categories)) {
    console.log(`  ${key}: ${cat.count} records`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run();
