// Rubric bank (after ci/internal-shortlisting's question bank): paste an existing OSCE checklist,
// the AI splits it into grading questions, the educator approves, and reuses them in scenarios.
import express from "express";
import mongoose from "mongoose";
import RubricItem from "../models/rubricItemModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { generateJsonWithFallback } from "../utils/aiText.js";

const router = express.Router();

const allow = (req, res, next) => (["educator", "school_admin"].includes(req.user.role) ? next() : res.status(403).json({ message: "Access denied" }));
// Educators see their own items; a school admin sees the school's.
const scope = (req) => (req.user.role === "educator" ? { educatorId: req.user._id } : { schoolId: req.user.schoolId });

// Line split for when no AI is available: one item per non-empty line, numbering and bullets removed,
// "Criterion:" headings carried down to the lines under them.
const splitLines = (text) => {
  let criterion = "";
  const items = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/^[\s>*•\-–\d.)\]]+/, "").trim();
    if (!line) continue;
    if (/^[A-Za-z][\w &/-]{1,60}:$/.test(line) || (/^[A-Z][A-Z &/-]{2,60}$/.test(line) && line.split(" ").length <= 6)) { criterion = line.replace(/:$/, ""); continue; }
    items.push({ text: line.slice(0, 1000), criterion });
  }
  return items;
};

router.get("/", protect, allow, async (req, res) => {
  try {
    const q = { ...scope(req) };
    if (req.query.criterion) q.criterion = req.query.criterion;
    if (req.query.search) q.text = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    res.json(await RubricItem.find(q).sort({ criterion: 1, createdAt: 1 }).limit(1000).lean());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rubrics/parse { text } -> { items: [{ text, criterion }], via } (nothing saved).
router.post("/parse", protect, allow, async (req, res) => {
  const text = String(req.body?.text || "").slice(0, 20000);
  if (!text.trim()) return res.status(400).json({ message: "Paste a checklist first." });
  try {
    const { json } = await generateJsonWithFallback({
      systemPrompt:
        "You turn a physiotherapy or occupational therapy assessment checklist (OSCE, history-taking rubric) into grading questions for an AI grader. " +
        "Return JSON {\"items\":[{\"text\":string,\"criterion\":string}]}. One item per thing the student should do or ask, phrased as a yes/no check " +
        "starting with \"Did the student...\". Keep the educator's meaning; do not invent items. criterion is the section it belongs to " +
        "(e.g. \"History of presenting complaint\", \"Red flags\", \"Psychosocial\", \"Communication\"); use the document's own headings when present.",
      userQuery: text,
    });
    const items = (json?.items || []).filter((i) => i && String(i.text || "").trim())
      .map((i) => ({ text: String(i.text).trim().slice(0, 1000), criterion: String(i.criterion || "").trim().slice(0, 120) }));
    if (items.length) return res.json({ items, via: "ai" });
    res.json({ items: splitLines(text), via: "lines" });
  } catch (err) {
    console.warn("[RUBRIC] AI split failed, splitting by line:", err.message);
    res.json({ items: splitLines(text), via: "lines" });
  }
});

// POST /api/rubrics { items: [{ text, criterion }], source } -> saved items.
router.post("/", protect, allow, async (req, res) => {
  try {
    const items = (Array.isArray(req.body?.items) ? req.body.items : [])
      .map((i) => ({ text: String(i.text || "").trim().slice(0, 1000), criterion: String(i.criterion || "").trim().slice(0, 120) }))
      .filter((i) => i.text).slice(0, 300);
    if (!items.length) return res.status(400).json({ message: "Nothing to save." });
    const source = String(req.body?.source || "").slice(0, 200);
    const docs = await RubricItem.insertMany(items.map((i) => ({ ...i, source, educatorId: req.user._id, schoolId: req.user.schoolId })));
    res.status(201).json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", protect, allow, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Not found" });
    const set = {};
    if (req.body?.text !== undefined) set.text = String(req.body.text).trim().slice(0, 1000);
    if (req.body?.criterion !== undefined) set.criterion = String(req.body.criterion).trim().slice(0, 120);
    const doc = await RubricItem.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, { $set: set }, { new: true });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/rubrics/used { ids } — counts reuse, so the bank can sort the most-used first.
router.post("/used", protect, allow, async (req, res) => {
  try {
    const ids = (req.body?.ids || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    await RubricItem.updateMany({ _id: { $in: ids }, ...scope(req) }, { $inc: { timesUsed: 1 } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", protect, allow, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Not found" });
    const r = await RubricItem.deleteOne({ _id: req.params.id, ...scope(req) });
    if (!r.deletedCount) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
