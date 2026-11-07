// Uploads avatar clips to the Voxio account (faces are account-level, reusable across flows).
// Usage: node scripts/uploadFaces.mjs [--apply] [--dir <clipsDir>] [--force]
//   default: dry run (preview every clip, report crop counts, upload nothing)
//   --apply: upload clips that have exactly one face crop; skip ones already in the manifest
// Clip label = path under dir: Neck/flexion/full.mp4 -> neck_flexion_full,
// Shoulder/left/flexion/90.mp4 -> shoulder_flexion_left_90, Rest.mp4 -> main.
// Manifest: docs/avatar/faces.json  { label: { uuid, name, description, frames, detector, file } }
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Voxio } from "voxioagent/server";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const AVATAR = path.join(ROOT, "docs/avatar");
const MANIFEST = path.join(AVATAR, "faces.json");
const PREVIEWS = path.join(AVATAR, "previews");

const args = process.argv.slice(2);
const BOX = Number(process.env.VOXIO_FACE_BOX ?? 0); // crop tile, same for every clip so the face never jumps
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const dirArg = args.indexOf("--dir");
const DIR = dirArg >= 0 ? args[dirArg + 1] : process.env.VOXIO_FACES_DIR;
if (!DIR || !fs.existsSync(DIR)) throw new Error("Clip dir not found; pass --dir or set VOXIO_FACES_DIR");
if (!process.env.VOXIO_USER_API_KEY) throw new Error("VOXIO_USER_API_KEY missing in .env");

const voxio = new Voxio({ secretKey: process.env.VOXIO_USER_API_KEY, environment: process.env.VOXIO_ENVIRONMENT || "gpu", timeoutMs: 15 * 60_000 });

// --- catalog (name + description) from avatar_movements.csv ---
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(Boolean));
  const h = head.map(s => s.replace(/^﻿/, "").trim());
  return body.map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? "").trim()])));
}
const catalog = Object.fromEntries(
  parseCsv(fs.readFileSync(path.join(AVATAR, "avatar_movements.csv"), "utf8")).map(r => [r.label, r])
);
function describe(r) {
  if (r.label === "main") return "Idle/rest clip; the avatar returns here after every movement.";
  const side = r.side ? ` ${r.side}` : "";
  return `${r.region}${side} ${r.movement.replace(/_/g, " ")} - ${r.version}`.trim();
}

// --- collect clips ---
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : /\.(mp4|mov|webm)$/i.test(e.name) ? [path.join(d, e.name)] : []);
}
function labelOf(file) {
  const parts = path.relative(DIR, file).replace(/\.[^.]+$/, "").split(/[\\/]/).map(s => s.toLowerCase());
  if (parts.length === 1 && parts[0] === "rest") return "main";
  // region/[side/]movement/version  ->  region_movement[_side]_version
  if (parts.length === 4) { const [region, side, move, ver] = parts; return `${region}_${move}_${side}_${ver}`; }
  if (parts.length === 3) { const [region, move, ver] = parts; return `${region}_${move}_${ver}`; }
  return parts.join("_");
}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
fs.mkdirSync(PREVIEWS, { recursive: true });

const clips = walk(DIR).map(file => ({ file, label: labelOf(file) }));
const report = { uploaded: [], skippedExisting: [], unknownLabel: [], badCrop: [], failed: [] };
console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${clips.length} clips in ${DIR}`);

for (const { file, label } of clips) {
  const row = catalog[label];
  if (!row) { report.unknownLabel.push(`${label}  (${path.relative(DIR, file)})`); console.log(`? ${label}: not in avatar_movements.csv`); continue; }
  if (manifest[label]?.uuid && !FORCE) { report.skippedExisting.push(label); console.log(`= ${label}: already uploaded`); continue; }
  try {
    const bytes = new Uint8Array(fs.readFileSync(file));
    const fileName = `${label}${path.extname(file).toLowerCase()}`;
    const prev = await voxio.faces.preview(bytes, { fileName });
    fs.writeFileSync(path.join(PREVIEWS, `${label}.png`), Buffer.from(await prev.image.arrayBuffer()));
    if (prev.count < 1) { report.badCrop.push(`${label} (no face)`); console.log(`! ${label}: no face found - skipped`); continue; }
    if (!APPLY) { console.log(`. ${label}: 1 face, ready`); continue; }
    const up = await voxio.faces.upload(bytes, { fileName, boxIndex: BOX });
    manifest[label] = { uuid: up.uuid, boxIndex: BOX, name: row.name, description: describe(row), frames: up.frames, detector: up.detector, file: path.relative(DIR, file).replace(/\\/g, "/") };
    save();
    report.uploaded.push(label);
    console.log(`+ ${label}: ${up.uuid} (${up.frames} frames)`);
  } catch (e) {
    report.failed.push(`${label}: ${e.code || ""} ${e.message}`);
    console.log(`x ${label}: ${e.message}`);
    if (report.failed.length === 1 && !report.uploaded.length && !args.includes("--keep-going")) { console.log("first call failed - stopping (use --keep-going to continue)"); break; }
  }
}

const expected = Object.keys(catalog);
const missing = expected.filter(l => !clips.some(c => c.label === l));
console.log("\n--- report ---");
for (const [k, v] of Object.entries(report)) console.log(`${k}: ${v.length}${v.length && k !== "uploaded" && k !== "skippedExisting" ? "\n  " + v.join("\n  ") : ""}`);
console.log(`clips not yet made: ${missing.length} of ${expected.length}`);
