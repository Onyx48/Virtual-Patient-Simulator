/**
 * Tests for the bulk student and educator upload parser.
 *
 * Run with: pnpm test:bulk  (or node scripts/testBulkUsers.mjs)
 *
 * There is no test runner in this repo, so this is a plain script with an assert
 * helper. It covers the CSV reader, the Excel reader (against a real workbook
 * built and re-read in memory) and every validation branch, because the whole
 * point of the parser is to reject bad rows in a way the user can act on.
 */
import * as XLSX from "xlsx";
import {
  DEPARTMENTS,
  IMPORT_COLUMNS,
  buildTemplateWorkbook,
  buildUserPayload,
  mapHeaders,
  normaliseHeader,
  rowsFromCsv,
  rowsFromWorkbook,
} from "../src/lib/bulkUsers.js";

let passed = 0;
const failures = [];

const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
};

console.log("\nnormaliseHeader");
check("trims and lowercases", normaliseHeader("  Email Address "), "email address");
check("collapses inner whitespace", normaliseHeader("Full   Name"), "full name");
check("treats _ - . as spaces", normaliseHeader("e-mail"), "e mail");
check("strips the BOM Excel writes", normaliseHeader("﻿Name"), "name");
check("survives a null cell", normaliseHeader(null), "");

console.log("\nmapHeaders");
check("canonical headers", mapHeaders(["Name", "Email"]).index, {
  name: 0,
  email: 1,
  optional: -1,
});
check("aliases, any order", mapHeaders(["Email Address", "Full Name"]).index, {
  name: 1,
  email: 0,
  optional: -1,
});
check("unknown columns are ignored", mapHeaders(["Id", "Name", "House", "E-Mail"]).index, {
  name: 1,
  email: 3,
  optional: -1,
});
check("the Group column is found for a student", mapHeaders(["Name", "Email", "Group"], "student").index, {
  name: 0,
  email: 1,
  optional: 2,
});
check("a student sheet ignores a Department column", mapHeaders(["Name", "Email", "Department"], "student").index.optional, -1);
check("the Department column is found for an educator", mapHeaders(["Name", "Email", "Subject"], "educator").index.optional, 2);
check("missing email is reported", mapHeaders(["Name"]).missing, [
  "'Email' (or 'Email Address')",
]);
check("missing both is reported", mapHeaders(["Grade", "House"]).missing, [
  "'Name' (or 'Full Name')",
  "'Email' (or 'Email Address')",
]);

console.log("\nCSV, the happy path");
const goodCsv = `Name,Email
Aisha Rahman,aisha.rahman@example.edu
Daniel Okafor,daniel.okafor@example.edu
`;
const good = buildUserPayload(rowsFromCsv(goodCsv));
check("both students parsed", good.users, [
  { name: "Aisha Rahman", email: "aisha.rahman@example.edu" },
  { name: "Daniel Okafor", email: "daniel.okafor@example.edu" },
]);
check("no errors", good.errors, []);
check("nothing missing", good.missing, []);
check("row count", good.totalRows, 2);

console.log("\nCSV, the messy realistic path");
const messyCsv = `﻿ Full Name , E-Mail ,Grade
 Aisha Rahman , AISHA@example.edu ,Year 2

Daniel Okafor,daniel@example.edu,Year 2
,orphan@example.edu,
No Email Here,,
Bad Address,not-an-email,
Dup Student,aisha@example.edu,
`;
const messy = buildUserPayload(rowsFromCsv(messyCsv));
check("aliases, BOM, padding and the extra column all handled", messy.users, [
  { name: "Aisha Rahman", email: "AISHA@example.edu" },
  { name: "Daniel Okafor", email: "daniel@example.edu" },
]);
check("every bad row reported, with the row number Excel shows", messy.errors, [
  { row: 5, email: "orphan@example.edu", reason: "Name is empty." },
  { row: 6, email: "—", reason: "Email is empty." },
  { row: 7, email: "not-an-email", reason: '"not-an-email" is not an email address.' },
  { row: 8, email: "aisha@example.edu", reason: "Duplicate of row 2 in this file." },
]);

console.log("\nCSV, rejected outright");
const noHeaders = buildUserPayload(rowsFromCsv("Grade,House\nYear 2,Blue\n"));
check("missing columns are named", noHeaders.missing, [
  "'Name' (or 'Full Name')",
  "'Email' (or 'Email Address')",
]);
check("nothing is imported from it", noHeaders.users, []);

const empty = buildUserPayload(rowsFromCsv(""));
check("an empty file imports nothing", empty.users, []);
check("an empty file asks for both columns", empty.missing, ["Name", "Email"]);

const headerOnly = buildUserPayload(rowsFromCsv("Name,Email\n"));
check("a header with no rows is valid but empty", headerOnly, {
  users: [],
  errors: [],
  missing: [],
  totalRows: 0,
});

console.log("\nExcel");
const sheet = XLSX.utils.aoa_to_sheet([
  ["Name", "Email"],
  ["Aisha Rahman", "aisha.rahman@example.edu"],
  ["", ""],
  ["Daniel Okafor", "daniel.okafor@example.edu"],
]);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "Students");
const xlsxBytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
const fromExcel = buildUserPayload(rowsFromWorkbook(new Uint8Array(xlsxBytes)));
check("a real .xlsx round-trips", fromExcel.users, [
  { name: "Aisha Rahman", email: "aisha.rahman@example.edu" },
  { name: "Daniel Okafor", email: "daniel.okafor@example.edu" },
]);
check("the blank row in the middle is not an error", fromExcel.errors, []);

/*
 * The reason `defval: ""` is set in rowsFromWorkbook. A blank first cell used to
 * shift the row left, so this student's email landed in the name column.
 */
const gapSheet = XLSX.utils.aoa_to_sheet([
  ["Name", "Email"],
  ["", "orphan@example.edu"],
]);
const gapBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(gapBook, gapSheet, "Students");
const gapRows = rowsFromWorkbook(
  new Uint8Array(XLSX.write(gapBook, { type: "array", bookType: "xlsx" })),
);
check("a blank cell does not shift the row", gapRows[1], ["", "orphan@example.edu"]);

console.log("\nGroups on a student sheet");
const groupCsv = `Name,Email,Group
Aisha Rahman,aisha@example.edu,Year 2 Group A
Daniel Okafor,daniel@example.edu,year 2 group a
Mei Tanaka,mei@example.edu,
`;
const grouped = buildUserPayload(rowsFromCsv(groupCsv), "student");
check("the group is carried through, cased as typed", grouped.users, [
  { name: "Aisha Rahman", email: "aisha@example.edu", group: "Year 2 Group A" },
  { name: "Daniel Okafor", email: "daniel@example.edu", group: "year 2 group a" },
  { name: "Mei Tanaka", email: "mei@example.edu" },
]);
check("an empty group cell is not an error", grouped.errors, []);
check(
  "'Cohort' works as the header too",
  buildUserPayload(rowsFromCsv("Name,Email,Cohort\nA B,ab@example.edu,Blue\n"), "student")
    .users[0].group,
  "Blue",
);
check(
  "no Group column leaves everyone ungrouped",
  buildUserPayload(rowsFromCsv("Name,Email\nA B,ab@example.edu\n"), "student").users[0],
  { name: "A B", email: "ab@example.edu" },
);
check(
  "a student sheet does not pick up a Department column",
  buildUserPayload(
    rowsFromCsv("Name,Email,Department\nA B,ab@example.edu,Science\n"),
    "student",
  ).users[0],
  { name: "A B", email: "ab@example.edu" },
);

console.log("\nDepartments on an educator sheet");
const eduCsv = `Full Name,Email,Subject
Priya Nair,priya@example.edu,Science
Tom Whitfield,tom@example.edu,mathematics
Ada Byron,ada@example.edu,
Bad Dept,bad@example.edu,Astrophysics
`;
const educators = buildUserPayload(rowsFromCsv(eduCsv), "educator");
check("the department is normalised to the enum's own casing", educators.users, [
  { name: "Priya Nair", email: "priya@example.edu", department: "Science" },
  { name: "Tom Whitfield", email: "tom@example.edu", department: "Mathematics" },
  { name: "Ada Byron", email: "ada@example.edu" },
]);
check("an unknown department is refused, not defaulted to Science", educators.errors, [
  {
    row: 5,
    email: "bad@example.edu",
    reason: `"Astrophysics" is not a department. Use one of: ${DEPARTMENTS.join(", ")}.`,
  },
]);

console.log("\nThe templates we hand out");
const readTemplate = (role) =>
  rowsFromWorkbook(
    new Uint8Array(
      XLSX.write(buildTemplateWorkbook(role), { type: "array", bookType: "xlsx" }),
    ),
  );

const studentTemplate = readTemplate("student");
check("student template headers", studentTemplate[0], IMPORT_COLUMNS.student);
const studentParsed = buildUserPayload(studentTemplate, "student");
check("the student template passes our own importer", studentParsed.errors, []);
check("its example rows parse", studentParsed.users.length, 3);
check(
  "two of its rows share a group, so the server has to reuse it",
  studentParsed.users.filter((u) => u.group === "Year 2 Group A").length,
  2,
);

const educatorTemplate = readTemplate("educator");
check("educator template headers", educatorTemplate[0], IMPORT_COLUMNS.educator);
const educatorParsed = buildUserPayload(educatorTemplate, "educator");
check("the educator template passes our own importer", educatorParsed.errors, []);
check(
  "its departments are all valid",
  educatorParsed.users.map((u) => u.department),
  ["Science", "Mathematics"],
);

console.log(
  `\n${failures.length === 0 ? "PASS" : "FAIL"} — ${passed} checks passed, ${failures.length} failed`,
);
if (failures.length > 0) {
  failures.forEach((label) => console.log(`  - ${label}`));
  process.exit(1);
}
