/**
 * Generates deterministic human-readable names for students whose
 * "name" field is a numeric enrollment ID (e.g. "2203504").
 * The name is derived from the email so the same email always gets
 * the same name — no random seed needed on re-runs.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import User from "../models/userModel.js";

const FIRST_NAMES = [
  "Aaron", "Adam", "Aditya", "Ahmad", "Alexander", "Alexis", "Amirah",
  "Andrew", "Ananya", "Anthony", "Arjun", "Ashley", "Ava", "Aziz",
  "Benjamin", "Brandon", "Brian", "Caleb", "Charlotte", "Chen",
  "Christopher", "Daniel", "David", "Deepak", "Derek", "Divya",
  "Dylan", "Emma", "Eric", "Ethan", "Farah", "Fang", "Gabriel",
  "Grace", "Gregory", "Hannah", "Hao", "Hassan", "Hui", "Ibrahim",
  "Ian", "Isabella", "Ismail", "James", "Jason", "Jeffrey", "Jessica",
  "Jing", "John", "Jonathan", "Joshua", "Jun", "Justin", "Kavya",
  "Ke", "Kevin", "Kyle", "Lauren", "Li", "Ling", "Logan", "Lucas",
  "Mark", "Matthew", "Meera", "Megan", "Mei", "Mia", "Michael",
  "Ming", "Muhammad", "Nathan", "Nicholas", "Nikhil", "Noor", "Nur",
  "Oliver", "Olivia", "Patrick", "Priya", "Qi", "Rachel", "Rajan",
  "Rahul", "Robert", "Rohan", "Rui", "Ryan", "Samuel", "Sanjay",
  "Sarah", "Scott", "Sean", "Siti", "Sophia", "Steven", "Thomas",
  "Timothy", "Tyler", "Vikram", "Wei", "William", "Xiao", "Xin",
  "Yan", "Yang", "Yun", "Zainab", "Zhi",
];

const LAST_NAMES = [
  "Abdullah", "Ahmad", "Ali", "Anderson", "Brown", "Chan", "Chen",
  "Cheng", "Chua", "Davis", "Goh", "Gupta", "Hall", "Hamid",
  "Harris", "Hassan", "Ibrahim", "Ismail", "Jackson", "Johnson",
  "Jones", "Ke", "Koh", "Krishnan", "Kumar", "Lau", "Lee", "Li",
  "Lim", "Liu", "Martin", "Moore", "Nair", "Ng", "Ong", "Patel",
  "Pillai", "Rahman", "Rao", "Reddy", "Santos", "Sharma", "Singh",
  "Soh", "Smith", "Tan", "Taylor", "Teo", "Thomas", "Thompson",
  "Walker", "Wang", "White", "Williams", "Wilson", "Wong", "Wu",
  "Yang", "Yap", "Young", "Yusof", "Zhang",
];

function hashEmail(email) {
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) + h) ^ email.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

function nameFromEmail(email) {
  const h = hashEmail(email.toLowerCase().trim());
  const first = FIRST_NAMES[h % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(h / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

const isNumericName = (name) => name && /^\d+$/.test(name.trim());

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const students = await User.find({ role: "student" }).select("name email");
  const toUpdate = students.filter((u) => isNumericName(u.name));

  console.log(`Total students: ${students.length}`);
  console.log(`Students with numeric names: ${toUpdate.length}`);
  console.log("\nSample mappings:");
  toUpdate.slice(0, 8).forEach((u) =>
    console.log(`  ${u.name} (${u.email}) → ${nameFromEmail(u.email)}`)
  );

  if (toUpdate.length === 0) {
    console.log("\nNothing to update.");
    await mongoose.disconnect();
    return;
  }

  const confirm = process.argv[2] === "--run";
  if (!confirm) {
    console.log("\nDry run. Pass --run to apply changes.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const user of toUpdate) {
    const generatedName = nameFromEmail(user.email);
    await User.findByIdAndUpdate(user._id, { name: generatedName });
    updated++;
  }

  console.log(`\nUpdated ${updated} student(s).`);
  await mongoose.disconnect();
  console.log("Done.");
};

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
