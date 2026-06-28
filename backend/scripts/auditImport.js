import fs from "fs";
import path from "path";

const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const recordPreview = (record, maxFields = 4) => {
  const entries = [];
  const keys = Object.keys(record);
  for (const key of keys) {
    if (entries.length >= maxFields) break;
    const val = record[key];
    if (val !== null && val !== undefined && val !== "") {
      const str = String(val).length > 60 ? String(val).slice(0, 57) + "..." : String(val);
      entries.push(`${key}: "${str}"`);
    }
  }
  if (entries.length === 0) return "(empty record)";
  return `{ ${entries.join(", ")} }`;
};

const auditSchools = (records) => {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const index = i + 1;
    if (!r.Name || !r.Email) {
      const reason = !r.Name && !r.Email ? "missing Name and Email"
        : !r.Name ? "missing Name"
        : "missing Email";
      const label = r.Name || r.Email || recordPreview(r);
      results.push({ index, valid: false, label, reason });
    } else {
      results.push({ index, valid: true, label: r.Name });
    }
  }
  return results;
};

const auditUsers = (records) => {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const index = i + 1;
    if (!r.email) {
      const label = r.Name || recordPreview(r);
      results.push({ index, valid: false, label, reason: "missing email" });
    } else {
      results.push({ index, valid: true, label: r.email });
    }
  }
  return results;
};

const auditEducators = (records) => {
  const results = [];
  const educatorMap = new Map();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const index = i + 1;
    if (!r["Email Address"]) {
      const label = r.Name || r.ID || recordPreview(r);
      results.push({ index, valid: false, label, reason: "missing Email Address" });
    } else {
      const email = r["Email Address"].toLowerCase();
      const label = r.Name || email;
      if (r.ID) educatorMap.set(r.ID, email);
      results.push({ index, valid: true, label });
    }
  }
  return { results, educatorMap };
};

const auditStudents = (records) => {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const index = i + 1;
    if (!r["Email Address"]) {
      const label = recordPreview(r);
      results.push({ index, valid: false, label, reason: "missing Email Address" });
    } else {
      results.push({ index, valid: true, label: r["Email Address"].toLowerCase() });
    }
  }
  return results;
};

const pickScenarioLabel = (r) => {
  const preferred = ["Name", "ID", "Description", "Creator", "educator", "school", "Status"];
  for (const key of preferred) {
    if (r[key] && r[key] !== "") return r[key];
  }
  return recordPreview(r);
};

const auditScenarios = (records, educatorMap) => {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const index = i + 1;

    let name = pickScenarioLabel(r);

    if (!r.Full || r.Full === "Unsupported Scenario") {
      const reason = !r.Full ? "missing Full JSON" : "Full JSON is 'Unsupported Scenario'";
      results.push({ index, valid: false, label: `${name} (idx ${index})`, reason });
      continue;
    }

    if (r.Full && typeof r.Full === "string") {
      const match = r.Full.match(/"scenario_name":"([^"]+)"/);
      if (match) name = match[1];
    }

    if (r.educator && !educatorMap.has(r.educator)) {
      results.push({ index, valid: false, label: `${name} (idx ${index})`, reason: `educator ID '${r.educator}' not found in educators file` });
      continue;
    }

    results.push({ index, valid: true, label: name });
  }
  return results;
};

const printSection = (title, filePath, results) => {
  console.log(`\n${title}`);
  console.log(`  File: ${filePath}`);
  let validCount = 0;
  let skipCount = 0;
  for (const r of results) {
    if (r.valid) {
      validCount++;
    } else {
      skipCount++;
      console.log(`  ✗ ${r.label} — ${r.reason}`);
    }
  }
  if (skipCount === 0) console.log(`  (all ${validCount} records valid)`);
  console.log(`  Total: ${validCount} valid, ${skipCount} skipped`);
};

const main = () => {
  const jsonFolder = process.argv[2];

  if (!jsonFolder) {
    console.error("Usage: node backend/scripts/auditImport.js <jsonFolderPath>");
    console.error("Example: node backend/scripts/auditImport.js \"D:\\downlaods\\tep\\tep\"");
    process.exit(1);
  }

  if (!fs.existsSync(jsonFolder)) {
    console.error(`Folder not found: ${jsonFolder}`);
    process.exit(1);
  }

  console.log("PRE-MIGRATION AUDIT");
  console.log("════════════════════════════════════════════════");
  console.log(`Source: ${jsonFolder}\n`);

  const fileMap = {
    "school/All Schools.json": { audit: auditSchools, label: "SCHOOLS" },
    "user/All Users.json": { audit: auditUsers, label: "USERS" },
    "educator/All Educators.json": { audit: auditEducators, label: "EDUCATORS" },
    "students/All Students.json": { audit: auditStudents, label: "STUDENTS" },
    "scenario/All Scenarios.json": { audit: auditScenarios, label: "SCENARIOS" },
  };

  const allResults = {};
  let filesMissing = 0;

  const educatorMap = new Map();

  for (const [relativePath, config] of Object.entries(fileMap)) {
    const fullPath = path.join(jsonFolder, relativePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`${config.label} — FILE NOT FOUND: ${relativePath}`);
      filesMissing++;
      continue;
    }

    const parsed = readJsonFile(fullPath);
    if (!parsed.success) {
      console.log(`${config.label} — INVALID JSON: ${relativePath} (${parsed.error})`);
      filesMissing++;
      continue;
    }

    let results;
    if (config.label === "SCENARIOS") {
      results = config.audit(parsed.data, educatorMap);
    } else if (config.label === "EDUCATORS") {
      const out = config.audit(parsed.data);
      results = out.results;
      for (const [id, email] of out.educatorMap) {
        educatorMap.set(id, email);
      }
    } else {
      results = config.audit(parsed.data);
    }

    allResults[config.label] = results;
    printSection(config.label, relativePath, results);
  }

  console.log("\n════════════════════════════════════════════════");
  console.log("SUMMARY\n");

  let totalValid = 0;
  let totalSkipped = 0;

  for (const [label, results] of Object.entries(allResults)) {
    const valid = results.filter((r) => r.valid).length;
    const skipped = results.filter((r) => !r.valid).length;
    totalValid += valid;
    totalSkipped += skipped;
    if (skipped > 0) {
      console.log(`  ${label}: ${valid}/${valid + skipped} valid (${skipped} skipped)`);
    } else {
      console.log(`  ${label}: ${valid}/${valid} valid`);
    }
  }

  console.log(`\n  Total: ${totalValid} will be imported, ${totalSkipped} will be skipped`);

  if (filesMissing > 0) {
    console.log(`\n  ${filesMissing} file(s) missing \u2014 import will be incomplete`);
  }

  if (totalSkipped > 0 || filesMissing > 0) {
    console.log("\n  Review skipped records above before running import.");
    process.exit(1);
  } else {
    console.log("\n  All records valid. Ready to import!");
    process.exit(0);
  }
};

main();
