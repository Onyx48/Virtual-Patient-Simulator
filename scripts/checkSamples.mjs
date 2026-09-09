/**
 * Runs the sample CSVs in samples/ through the real importer.
 *
 * Run with: pnpm check:samples
 *
 * These files are handed to users as "this is what a valid upload looks like", so
 * they have to be verified rather than assumed — a sample that our own parser
 * rejects is worse than no sample at all. Kept separate from the unit tests
 * because this one reads from disk.
 */
import fs from "node:fs";
import path from "node:path";
import { buildUserPayload, rowsFromCsv } from "../src/lib/bulkUsers.js";

const samples = [
  { file: "samples/students-sample.csv", role: "student", expected: 10 },
  { file: "samples/educators-sample.csv", role: "educator", expected: 6 },
];

let ok = true;

for (const { file, role, expected } of samples) {
  const text = fs.readFileSync(path.resolve(file), "utf8");
  const { users, errors, missing, totalRows } = buildUserPayload(rowsFromCsv(text), role);

  console.log(`\n${file}  (as ${role})`);
  console.log(`  rows in file:  ${totalRows}`);
  console.log(`  accepted:      ${users.length}`);
  console.log(`  rejected:      ${errors.length}`);

  if (missing.length > 0) {
    console.log(`  MISSING COLUMNS: ${missing.join(", ")}`);
    ok = false;
  }
  if (errors.length > 0) {
    errors.forEach((e) => console.log(`  REJECTED row ${e.row}: ${e.reason}`));
    ok = false;
  }
  if (users.length !== expected) {
    console.log(`  EXPECTED ${expected} accepted rows, got ${users.length}`);
    ok = false;
  }

  console.log("  parsed as:");
  users.forEach((u) => {
    const extra = u.group ?? u.department ?? "(none)";
    console.log(`    ${u.name.padEnd(20)} ${u.email.padEnd(34)} ${extra}`);
  });

  // The distinct groups are what the server will find-or-create, one per name.
  if (role === "student") {
    const groups = [...new Set(users.map((u) => u.group).filter(Boolean))];
    console.log(`  groups the import will resolve: ${groups.join(" | ")}`);
    console.log(`  students left ungrouped: ${users.filter((u) => !u.group).length}`);
  }
}

console.log(`\n${ok ? "PASS — both samples are valid uploads" : "FAIL — see above"}`);
if (!ok) process.exit(1);
