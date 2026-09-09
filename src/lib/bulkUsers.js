/**
 * Parsing and validation for the bulk student upload.
 *
 * Kept out of the page component for two reasons: the same logic has to run over
 * a CSV and over an Excel workbook, and it is the one part of the feature worth
 * testing without a browser (see scripts/testBulkStudents.mjs).
 *
 * The file the user picks is turned into rows of raw cells by one of the two
 * readers below, and everything after that — header matching, validation,
 * dedupe — is shared and pure.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";

/*
 * Name and Email are required for both roles. There is no Password column: the
 * backend generates one and emails it, so a password in the sheet would be
 * silently ignored — better not to offer it and imply it works.
 */
export const REQUIRED_COLUMNS = ["Name", "Email"];

/*
 * The one optional column each role gets, and the only difference between the
 * two templates.
 *
 * Group is a student's cohort. It is matched on the name, and the server creates
 * the group if no group of that name exists yet — so a whole cohort can be
 * imported in one file without creating the group by hand first.
 *
 * Department is fixed by the enum on userModel.js, so an unrecognised value is a
 * rejected row rather than a guess.
 */
export const DEPARTMENTS = ["Science", "History", "English", "Mathematics"];

export const IMPORT_COLUMNS = {
  student: [...REQUIRED_COLUMNS, "Group"],
  educator: [...REQUIRED_COLUMNS, "Department"],
};

/*
 * Accepted spellings of each column. Excel exports and hand-made sheets vary
 * more than they should, and rejecting a sheet whose header says "Email Address"
 * is a worse outcome than accepting it.
 */
const COLUMN_ALIASES = {
  name: ["name", "full name", "fullname", "student name", "student", "educator name"],
  email: ["email", "email address", "e mail", "mail", "email id"],
  group: ["group", "group name", "class", "cohort", "section", "batch"],
  department: ["department", "dept", "subject"],
};

/** The optional field this role's sheet may carry, or null if it has none. */
const optionalFieldFor = (role) =>
  ({ student: "group", educator: "department" })[role] ?? null;

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

/*
 * Header cells are compared with case, surrounding whitespace, inner runs of
 * whitespace and separator punctuation all normalised away, because "E-Mail",
 * "email_address" and " Email Address " are the same column to a reader. A
 * leading BOM is stripped too: Excel writes one at the start of a CSV it saved
 * as UTF-8, and it otherwise becomes part of the first header's name.
 */
export const normaliseHeader = (header) =>
  String(header ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/*
 * Deliberately loose. This only catches a cell that cannot be an address at all
 * — no @, no dot after it, or whitespace inside — and leaves anything arguable
 * to the server, which is the only place that can really judge. A strict pattern
 * rejects valid addresses, and the cost of that is a student who cannot be
 * imported at all.
 */
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const cell = (value) => {
  // Excel hands back numbers and dates as their own types, so a sheet whose
  // Name column holds "12345" would otherwise reach .trim() as a number.
  if (value == null) return "";
  return String(value).trim();
};

/**
 * Match the sheet's headers onto the fields this role uses.
 *
 * The optional column is reported as an index of -1 when it is absent, which is
 * not an error — a student sheet with no Group column just leaves everyone
 * ungrouped.
 *
 * @returns {{ index: {name: number, email: number, optional: number}, optionalField: string|null, missing: string[] }}
 *   `missing` is what the user has to fix, phrased with the spellings they can
 *   use rather than only the canonical one.
 */
export const mapHeaders = (headerRow, role = "student") => {
  const normalised = headerRow.map(normaliseHeader);
  const find = (aliases) => normalised.findIndex((h) => aliases.includes(h));
  const optionalField = optionalFieldFor(role);

  const index = {
    name: find(COLUMN_ALIASES.name),
    email: find(COLUMN_ALIASES.email),
    optional: optionalField ? find(COLUMN_ALIASES[optionalField]) : -1,
  };

  const missing = [];
  if (index.name === -1) missing.push("'Name' (or 'Full Name')");
  if (index.email === -1) missing.push("'Email' (or 'Email Address')");

  return { index, optionalField, missing };
};

/**
 * Turn rows of raw cells into the payload POST /api/users/bulk expects.
 *
 * Every rejected row is reported with its number as the user sees it in Excel —
 * the header is row 1, so the first student is row 2. A silent skip is the worst
 * outcome here: someone uploads 40 students, 38 are created, and nothing says
 * which two are missing.
 *
 * @param {string[][]} rows Header row first, then one row per person.
 * @param {"student"|"educator"} role Decides the optional column and its rules.
 * @returns {{ users: {name: string, email: string, group?: string, department?: string}[], errors: {row: number, email: string, reason: string}[], missing: string[], totalRows: number }}
 */
export const buildUserPayload = (rows, role = "student") => {
  const isBlank = (row) =>
    !Array.isArray(row) || row.every((value) => cell(value) === "");

  /*
   * Rows are indexed in place rather than compacted first, so a blank line
   * anywhere in the file does not shift the numbers reported below. Compacting
   * made every error after a gap point one row too high, which sends the user
   * to the wrong line of their spreadsheet — worse than no row number at all.
   */
  const headerIndex = rows.findIndex((row) => !isBlank(row));
  if (headerIndex === -1) {
    return { users: [], errors: [], missing: REQUIRED_COLUMNS, totalRows: 0 };
  }

  const dataRows = rows
    .slice(headerIndex + 1)
    .map((row, offset) => ({ row, number: headerIndex + offset + 2 }))
    .filter(({ row }) => !isBlank(row));

  const { index, optionalField, missing } = mapHeaders(rows[headerIndex], role);
  if (missing.length > 0) {
    return { users: [], errors: [], missing, totalRows: dataRows.length };
  }

  const users = [];
  const errors = [];
  // Duplicates inside one file are caught here rather than left to the server:
  // it would create the first and reject the second as "Email already exists",
  // which reads as though the student was already in the system.
  const seen = new Map();

  dataRows.forEach(({ row, number }) => {
    const name = cell(row[index.name]);
    const email = cell(row[index.email]);
    const fail = (reason) => errors.push({ row: number, email: email || "—", reason });

    if (!name) return fail("Name is empty.");
    if (!email) return fail("Email is empty.");
    if (!looksLikeEmail(email)) return fail(`"${email}" is not an email address.`);

    const key = email.toLowerCase();
    if (seen.has(key)) return fail(`Duplicate of row ${seen.get(key)} in this file.`);

    // The server lowercases the address itself; sent as typed so an error
    // message quotes back what the user actually wrote.
    const person = { name, email };
    const extra = index.optional === -1 ? "" : cell(row[index.optional]);

    if (optionalField === "department" && extra) {
      /*
       * Matched case-insensitively but sent in the enum's own casing, because
       * userModel.js validates against exactly those four strings and "science"
       * would be rejected by Mongoose after the row had already been accepted
       * here. An unrecognised subject is refused rather than quietly turned into
       * Science, which is what the server used to do — an educator ended up in a
       * department nobody had chosen.
       */
      const match = DEPARTMENTS.find((d) => d.toLowerCase() === extra.toLowerCase());
      if (!match) {
        return fail(`"${extra}" is not a department. Use one of: ${DEPARTMENTS.join(", ")}.`);
      }
      person.department = match;
    }

    // Any non-empty name is a valid group: the server creates it if it is new.
    if (optionalField === "group" && extra) person.group = extra;

    seen.set(key, number);
    users.push(person);
  });

  return { users, errors, missing: [], totalRows: dataRows.length };
};

/** Rows out of CSV text. Papa is given no header option — we match headers ourselves. */
export const rowsFromCsv = (text) => {
  /*
   * Empty lines are deliberately kept. buildStudentPayload skips them itself,
   * and it needs them present to report a row number that matches what the user
   * sees in their spreadsheet — Papa dropping them silently renumbered every
   * row after a gap.
   */
  const { data } = Papa.parse(text, { skipEmptyLines: false });
  return data;
};

/**
 * Rows out of an .xlsx/.xls workbook.
 *
 * Only the first sheet is read. A workbook with the students on sheet 2 is rare
 * enough that guessing which sheet was meant is more likely to import the wrong
 * thing than to help.
 *
 * `defval: ""` keeps the row arrays aligned — without it a blank cell is dropped
 * and every column after it shifts left by one.
 */
export const rowsFromWorkbook = (data) => {
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  // blankrows keeps a gap in the sheet as a row, for the same numbering reason
  // as the CSV reader above.
  return XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: false,
  });
};

/**
 * Read whatever the user picked.
 *
 * The extension decides the reader, because a mis-set browser MIME type is
 * common (Windows reports .csv as application/vnd.ms-excel) while the extension
 * is what the user actually chose.
 */
export const readRows = async (file) => {
  const lower = file.name.toLowerCase();
  const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");

  if (isExcel) return rowsFromWorkbook(new Uint8Array(await file.arrayBuffer()));
  if (lower.endsWith(".csv")) return rowsFromCsv(await file.text());

  throw new Error(
    `"${file.name}" is not a spreadsheet. Use a ${ACCEPTED_EXTENSIONS.join(", ")} file.`,
  );
};

/*
 * The example rows in the downloadable template.
 *
 * Real-looking rather than "Student One / a@b.com", so it is obvious at a glance
 * what belongs in each column — and obvious that these are examples to delete
 * rather than data to keep. Two students share a group on purpose: that is what
 * shows the group is matched by name and not created once per row.
 */
const TEMPLATE_ROWS = {
  student: [
    ["Aisha Rahman", "aisha.rahman@example.edu", "Year 2 Group A"],
    ["Daniel Okafor", "daniel.okafor@example.edu", "Year 2 Group A"],
    ["Mei Tanaka", "mei.tanaka@example.edu", "Year 2 Group B"],
  ],
  educator: [
    ["Priya Nair", "priya.nair@example.edu", "Science"],
    ["Tom Whitfield", "tom.whitfield@example.edu", "Mathematics"],
  ],
};

const TEMPLATE_FILENAMES = {
  student: "student-upload-template.xlsx",
  educator: "educator-upload-template.xlsx",
};

export const templateFilename = (role) =>
  TEMPLATE_FILENAMES[role] ?? "upload-template.xlsx";

/**
 * The template as a real .xlsx workbook, ready to hand to a download.
 *
 * Built with XLSX rather than as CSV text so the download opens cleanly in Excel
 * — a .csv renamed .xlsx makes Excel warn about the file format on every open.
 */
export const buildTemplateWorkbook = (role = "student") => {
  const columns = IMPORT_COLUMNS[role] ?? REQUIRED_COLUMNS;
  const sheet = XLSX.utils.aoa_to_sheet([columns, ...(TEMPLATE_ROWS[role] ?? [])]);
  // Wide enough that the headers and the example addresses are readable without
  // the user having to drag the column edges before they can read their own file.
  sheet["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    role === "educator" ? "Educators" : "Students",
  );
  return workbook;
};
