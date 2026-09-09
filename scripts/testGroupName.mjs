/**
 * Tests for group-name matching used by bulk student import.
 *
 * Run with: pnpm test:groups  (or node scripts/testGroupName.mjs)
 *
 * This is the half of the group feature that can be tested without Mongo: given
 * a name from a spreadsheet, does the matcher find the same group again? The
 * find-or-create around it is a database call and is not covered here.
 */
import { groupNameMatcher } from "../backend/utils/groupName.js";

let passed = 0;
const failures = [];

const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(
      `  FAIL ${label}\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`,
    );
  }
};

console.log("\nA name always matches itself");
for (const name of [
  "Year 2 Group A",
  "Year 2 (A)",
  "Group [1]",
  "A+B",
  "a.b",
  "Class $1",
  "Cohort|X",
  "Group\\Two",
]) {
  check(`matches ${JSON.stringify(name)}`, groupNameMatcher(name).test(name), true);
}

console.log("\nCase and padding are ignored");
check("lowercase matches", groupNameMatcher("Year 2 Group A").test("year 2 group a"), true);
check("uppercase matches", groupNameMatcher("year 2 group a").test("YEAR 2 GROUP A"), true);
check("the name is trimmed", groupNameMatcher("  Year 2 Group A  ").test("Year 2 Group A"), true);

console.log("\nDifferent groups stay different");
check(
  "Group A does not match Group B",
  groupNameMatcher("Year 2 Group A").test("Year 2 Group B"),
  false,
);
check("it is anchored at both ends", groupNameMatcher("Group A").test("Group A2"), false);
check("and at the start", groupNameMatcher("Group A").test("My Group A"), false);

/*
 * The point of escaping. Unescaped, "A.B" would match "AxB" and "Group [1]"
 * would be read as a character class — the import would file students into a
 * group nobody named.
 */
console.log("\nMetacharacters are literal, not patterns");
check('"A.B" does not match "AxB"', groupNameMatcher("A.B").test("AxB"), false);
check('"Group [1]" does not match "Group 1"', groupNameMatcher("Group [1]").test("Group 1"), false);
check('"A+B" does not match "AAB"', groupNameMatcher("A+B").test("AAB"), false);
check('"Year.*" does not match everything', groupNameMatcher("Year.*").test("Year 2"), false);

console.log(
  `\n${failures.length === 0 ? "PASS" : "FAIL"} — ${passed} checks passed, ${failures.length} failed`,
);
if (failures.length > 0) {
  failures.forEach((label) => console.log(`  - ${label}`));
  process.exit(1);
}
