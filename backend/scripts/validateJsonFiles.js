/**
 * JSON Files Validator
 * Validates all required JSON files are present and have correct structure
 *
 * Usage: node validateJsonFiles.js <jsonFolderPath>
 * Example: node validateJsonFiles.js "D:\downlaods\tep\tep"
 */

import fs from "fs";
import path from "path";

const REQUIRED_STRUCTURE = {
  "school/All Schools.json": ["Name", "Email", "Description"],
  "user/All Users.json": ["email", "Name", "is_educator"],
  "educator/All Educators.json": ["Email Address", "Name", "ID"],
  "students/All Students.json": ["Email Address", "educator", "group"],
  "scenario/All Scenarios.json": ["Full", "educator", "Difficulty Level"],
};

const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const validateFileStructure = (data, requiredFields) => {
  if (!Array.isArray(data)) {
    return { valid: false, message: "Data is not an array" };
  }

  if (data.length === 0) {
    return { valid: false, message: "File is empty" };
  }

  // Check first 5 records
  const sampleSize = Math.min(5, data.length);
  let missingFields = [];

  for (let i = 0; i < sampleSize; i++) {
    const record = data[i];
    for (const field of requiredFields) {
      if (!(field in record) && !missingFields.includes(field)) {
        missingFields.push(field);
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      message: `Missing fields: ${missingFields.join(", ")}`,
    };
  }

  return { valid: true, message: `Valid (${data.length} records)` };
};

const main = async () => {
  const jsonFolder = process.argv[2];

  if (!jsonFolder) {
    console.error("❌ Usage: node validateJsonFiles.js <jsonFolderPath>");
    console.error("Example: node validateJsonFiles.js 'D:\\downlaods\\tep\\tep'");
    process.exit(1);
  }

  if (!fs.existsSync(jsonFolder)) {
    console.error(`❌ Folder not found: ${jsonFolder}`);
    process.exit(1);
  }

  console.log("📋 VALIDATING JSON FILES...\n");
  console.log(`📁 Source folder: ${jsonFolder}\n`);

  let allValid = true;
  const results = [];

  for (const [relativePath, requiredFields] of Object.entries(REQUIRED_STRUCTURE)) {
    const fullPath = path.join(jsonFolder, relativePath);
    console.log(`Checking: ${relativePath}`);

    if (!fs.existsSync(fullPath)) {
      console.log(`  ❌ FILE NOT FOUND\n`);
      allValid = false;
      results.push({ file: relativePath, status: "MISSING" });
      continue;
    }

    const result = readJsonFile(fullPath);

    if (!result.success) {
      console.log(`  ❌ JSON PARSE ERROR: ${result.error}\n`);
      allValid = false;
      results.push({ file: relativePath, status: "INVALID_JSON" });
      continue;
    }

    const validation = validateFileStructure(result.data, requiredFields);

    if (validation.valid) {
      console.log(`  ✅ ${validation.message}`);
      results.push({
        file: relativePath,
        status: "VALID",
        records: result.data.length,
      });
    } else {
      console.log(`  ⚠️ ${validation.message}`);
      allValid = false;
      results.push({ file: relativePath, status: "INVALID_STRUCTURE" });
    }

    console.log("");
  }

  // Summary
  console.log("════════════════════════════════════════════");
  console.log("📊 VALIDATION SUMMARY\n");

  let totalRecords = 0;
  for (const result of results) {
    const status = result.status === "VALID" ? "✅" : "❌";
    const records = result.records ? ` (${result.records} records)` : "";
    console.log(`${status} ${result.file}${records}`);
    if (result.records) totalRecords += result.records;
  }

  console.log(`\n📈 Total Records: ${totalRecords}`);

  if (allValid) {
    console.log("\n✅ All files are valid! Ready for import.\n");
    console.log("Next steps:");
    console.log("1. Run migration script:");
    console.log(`   node migrateFromBubble.js "${jsonFolder}"\n`);
    console.log("   OR\n");
    console.log("2. Use API endpoints:");
    console.log("   POST http://localhost:5001/api/import/bulk");
    process.exit(0);
  } else {
    console.log(
      "\n❌ Some files have issues. Please fix them before importing.\n"
    );
    console.log("Common issues:");
    console.log("- File not found: Check folder path");
    console.log("- Invalid JSON: Open with text editor, look for syntax errors");
    console.log("- Missing fields: Verify exported data from Bubble.io includes all fields");
    process.exit(1);
  }
};

main();
