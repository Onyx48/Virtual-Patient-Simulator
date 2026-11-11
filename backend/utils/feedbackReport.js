/*
 * The History Taking Feedback Report as a PDF, after the client's template
 * (Notion: VPS_History_Taking_Feedback_Report_Template 29102026):
 *   header · 1 score by criterion · 2 behaviours and evidence by criterion · 3 self-reflection
 *   · 4 feedback for the learner · 5 clinical reasoning (when saved) · 6 key reminders.
 * Built on request from the stored session, so an educator's corrections are always in it.
 *
 * Ratings per criterion are derived from the behaviours under it (met 1, partly 0.5): 85%+ = 4,
 * 65%+ = 3, 40%+ = 2, else 1. Criterion 4 (Relevance & Prioritisation) is an overall judgement with
 * no checklist questions; until the grader rates it, it is shown as not rated and left out of the total.
 */
import PDFDocument from "pdfkit";

const C = {
  ink: "#1C1B18", muted: "#6B665D", line: "#E7E3DA", cell: "#F6F4EF",
  accent: "#FF9A56", accentSoft: "#FFF1E6", ok: "#0FA05C", warn: "#C46800", danger: "#E63935",
};
const LEVEL = { 4: "Highly proficient", 3: "Proficient", 2: "Developing", 1: "Needs development" };
// The client's dashboard order (template section 1).
const ORDER = ["Relevant History Gathering", "Follow-Up & Probing", "Psychosocial & Contextual Exploration", "Relevance & Prioritisation",
  "Red Flags & Safety Screening", "Questioning Technique & Communication", "Organisation & Adaptability", "Presenting Concern Exploration"];
const REMINDERS = [
  ["Start with respect.", "Introduce yourself, explain the purpose of the session, and use the patient's name. First impressions shape how openly the patient shares information."],
  ["Ask one clear question at a time.", "Keep questions short and complete. Start open (\"Tell me about your pain\"), then narrow down with closed questions."],
  ["Use everyday language.", "Avoid jargon, or explain it when you need to use it."],
  ["Explain before you ask sensitive questions.", "Tell the patient why you need to ask about bladder, bowel, weight loss or mental health before asking."],
  ["Never skip red flags.", "Always screen for serious pathology and follow up on any positive or uncertain answer."],
  ["Ask what the patient thinks and wants.", "Explore their beliefs, worries and goals. These often matter as much as the physical findings."],
  ["Listen, then summarise.", "Let the patient finish, signpost when you change topic, and summarise at the end to check you have understood."],
];

const verdict = (r) => r.review?.observed || r.observed;
const ratingOf = (rows) => {
  if (!rows.length) return null;
  const pct = rows.reduce((s, r) => s + (verdict(r) === "yes" ? 1 : verdict(r) === "partly" ? 0.5 : 0), 0) / rows.length;
  return pct >= 0.85 ? 4 : pct >= 0.65 ? 3 : pct >= 0.4 ? 2 : 1;
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** criteria: [{ name, rating, rows }], total: { points, max, percent } */
export function reportModel(session) {
  const results = session.question_results || [];
  const known = new Set(ORDER.map((x) => x.toLowerCase()));
  const criteria = ORDER.map((name) => {
    const rows = results.filter((r) => String(r.criterion || "").toLowerCase() === name.toLowerCase()).sort((a, b) => a.number - b.number);
    return { name, rows, rating: ratingOf(rows) };
  });
  const other = results.filter((r) => !known.has(String(r.criterion || "").toLowerCase()));
  if (other.length) criteria.push({ name: "Other behaviours", rows: other, rating: ratingOf(other), extra: true });
  const rated = criteria.filter((c) => !c.extra && c.rating != null);
  const points = rated.reduce((s, c) => s + c.rating, 0), max = rated.length * 4;
  return { criteria, total: { points, max, percent: max ? Math.round((points / max) * 100) : null } };
}

/** Streams the PDF to `out` (an HTTP response or any writable). */
export function writeReport(out, { session, learner, cohort, scenario, attempt }) {
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 64, left: 56, right: 56 }, bufferPages: true,
    info: { Title: `History Taking Feedback Report: ${learner || "Learner"}`, Author: "VPS Clinical" } });
  doc.pipe(out);
  const W = doc.page.width - 112, X = 56;
  const { criteria, total } = reportModel(session);

  const ensure = (h) => { if (doc.y + h > doc.page.height - 72) doc.addPage(); };
  const h1 = (t) => { ensure(120); doc.moveDown(0.6).font("Helvetica-Bold").fontSize(15).fillColor(C.ink).text(t, X); doc.moveDown(0.3); };
  const p = (t, o = {}) => doc.font(o.bold ? "Helvetica-Bold" : o.italic ? "Helvetica-Oblique" : "Helvetica").fontSize(o.size || 10.5).fillColor(o.color || C.ink).text(t, o.x ?? X, o.y, { width: o.w ?? W, lineGap: 2, ...o.opts });
  const rule = () => { doc.moveTo(X, doc.y).lineTo(X + W, doc.y).lineWidth(0.6).strokeColor(C.line).stroke(); doc.moveDown(0.4); };
  const pill = (x, y, label, color) => {
    doc.font("Helvetica-Bold").fontSize(8.5);
    const w = doc.widthOfString(label) + 12;
    doc.roundedRect(x, y, w, 15, 7.5).fill(color).fillColor("#FFFFFF").text(label, x + 6, y + 3.6, { lineBreak: false });
    return w;
  };

  // ---- header
  doc.rect(0, 0, doc.page.width, 6).fill(C.accent);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.muted).text("VPS CLINICAL", X, 40, { characterSpacing: 1.2 });
  doc.font("Helvetica-Bold").fontSize(22).fillColor(C.ink).text("History Taking Feedback Report", X, 54);
  if (scenario?.profession) p(scenario.profession === "occupational_therapy" ? "Occupational Therapy" : "Musculoskeletal (MSK) Physiotherapy", { color: C.muted });
  doc.moveDown(0.8);
  const minutes = session.updatedAt && session.createdAt ? Math.round((new Date(session.updatedAt) - new Date(session.createdAt)) / 60000) : null;
  const meta = [["Learner", learner || "—"], ["Programme / cohort", cohort || "—"], ["Scenario", scenario?.scenarioName || "—"],
    ["Session date", fmtDate(session.createdAt)], ["Attempt", attempt ? String(attempt) : "—"], ["Duration", minutes > 0 && minutes < 120 ? `About ${minutes} min` : "—"]];
  const top = doc.y, colW = W / 3;
  doc.roundedRect(X, top, W, 84, 10).fill(C.cell);
  meta.forEach(([k, v], i) => {
    const x = X + 14 + (i % 3) * colW, y = top + 12 + Math.floor(i / 3) * 36;
    doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(k, x, y, { width: colW - 20 });
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.ink).text(v, x, y + 12, { width: colW - 20, height: 14, ellipsis: true });
  });
  doc.y = top + 98;
  p("How to read this report: Section 1 rates each of the 8 History Taking criteria. Section 2 shows the evidence behind each rating: the behaviours that relate to it, whether each was observed, and what in the conversation showed it. AI-assisted and reviewed by your educator where marked.", { size: 9, color: C.muted });

  // ---- 1. score
  h1("1  History Taking score");
  const cols = [24, W - 24 - 70 - 120, 70, 120];
  const row = (cells, o = {}) => {
    ensure(22);
    const y = doc.y;
    if (o.fill) doc.rect(X, y - 3, W, 20).fill(o.fill);
    let x = X;
    cells.forEach((c, i) => {
      doc.font(o.bold ? "Helvetica-Bold" : "Helvetica").fontSize(o.size || 10).fillColor(o.color?.[i] || C.ink)
        .text(c, x + 4, y + 2, { width: cols[i] - 8, align: i === 2 ? "center" : "left", lineBreak: false, ellipsis: true });
      x += cols[i];
    });
    doc.y = y + 20;
  };
  row(["#", "Criterion", "Rating", "Level"], { bold: true, size: 9, fill: C.cell, color: [C.muted, C.muted, C.muted, C.muted] });
  criteria.filter((c) => !c.extra).forEach((c, i) => {
    row([String(i + 1), c.name, c.rating ? `${c.rating} / 4` : "—", c.rating ? LEVEL[c.rating] : "Not rated in this version"],
      { color: [C.muted, C.ink, C.ink, c.rating ? C.ink : C.muted] });
    doc.moveTo(X, doc.y - 2).lineTo(X + W, doc.y - 2).lineWidth(0.4).strokeColor(C.line).stroke();
  });
  row(["", "Total", total.max ? `${total.points} / ${total.max}` : "—", total.percent != null ? `${total.percent}%` : "—"], { bold: true, fill: C.accentSoft });
  doc.moveDown(0.4);
  p("Rating scale: 4 Highly proficient · 3 Proficient · 2 Developing · 1 Needs development. Each rating follows from the behaviours under it (met counts 1, partly 0.5): 85% or more 4, 65% or more 3, 40% or more 2, otherwise 1. Score = points ÷ maximum × 100.", { size: 8.5, color: C.muted });

  // ---- 2. behaviours
  h1("2  Behaviours by criterion");
  criteria.forEach((c, ci) => {
    ensure(70);
    doc.moveDown(0.3);
    p(c.extra ? c.name : `Criterion ${ci + 1}: ${c.name}`, { bold: true, size: 11.5 });
    p(c.rating ? `Rating ${c.rating} / 4 · ${LEVEL[c.rating]}` : c.rows.length ? "" : "An overall judgement of the interview, with no checklist behaviours.", { size: 9, color: C.muted });
    doc.moveDown(0.2);
    c.rows.forEach((r) => {
      const v = verdict(r);
      const label = v === "yes" ? "OBSERVED" : v === "partly" ? "PARTLY" : "NOT OBSERVED";
      const evidence = r.evidence ? `“${String(r.evidence).replace(/^["“]|["”]$/g, "")}”` : "";
      doc.font("Helvetica").fontSize(10);
      const hText = doc.heightOfString(`${r.question} (Q${r.number})`, { width: W - 110, lineGap: 2 });
      doc.font("Helvetica-Oblique").fontSize(9);
      const hEv = evidence ? doc.heightOfString(evidence, { width: W - 110, lineGap: 1.5 }) + 3 : 0;
      const hNote = r.review ? 14 : 0;
      ensure(hText + hEv + hNote + 12);
      const y = doc.y;
      pill(X, y, label, v === "yes" ? C.ok : v === "partly" ? C.warn : C.danger);
      p(`${r.question} (Q${r.number})`, { x: X + 104, y, w: W - 110, size: 10 });
      if (evidence) p(evidence, { x: X + 104, w: W - 110, size: 9, italic: true, color: C.muted, opts: { lineGap: 1.5 } });
      if (r.review) p(`Reviewed by ${r.review.byName || "your educator"}${r.review.note ? `: ${r.review.note}` : ""}`, { x: X + 104, w: W - 110, size: 8.5, color: C.warn });
      doc.y = Math.max(doc.y, y + 16) + 6;
    });
    rule();
  });

  // ---- 3. self-reflection
  h1("3  Self-reflection");
  const ref = session.reflection;
  if (ref?.summary || ref?.self_rating != null) {
    if (ref.summary) p(`“${ref.summary}”`, { italic: true });
    if (ref.self_rating != null) { doc.moveDown(0.3); p(`Self-rating: ${ref.self_rating} / 10${total.percent != null ? ` · History Taking score: ${total.percent}%` : ""}`, { size: 9.5, color: C.muted }); }
    p("Captured straight after the session, before any feedback was shown.", { size: 8.5, color: C.muted });
  } else p("No self-reflection was recorded for this session.", { color: C.muted });

  // ---- 4. feedback
  h1("4  Feedback for the learner");
  if (session.feedback) String(session.feedback).split(/\n\s*\n/).filter(Boolean).forEach((para) => { ensure(40); p(para.trim()); doc.moveDown(0.5); });
  else p("No written feedback for this session.", { color: C.muted });

  // ---- 5. clinical reasoning
  const cr = session.clinical_reasoning;
  if (cr) {
    h1("5  Clinical reasoning");
    if (cr.percent != null) p(`Score: ${cr.percent}%`, { bold: true });
    if (cr.summary) { doc.moveDown(0.2); p(cr.summary); }
    (cr.criteria || []).forEach((r) => {
      ensure(18);
      const y = doc.y + 4;
      p(r.name, { y, w: W - 200, size: 10 });
      p(`${r.final} / 4 · ${LEVEL[r.final] || ""}`, { x: X + W - 190, y, w: 190, size: 9.5, color: C.muted, opts: { align: "right" } });
      doc.y = Math.max(doc.y, y + 14);
    });
    [["What went well", cr.went_well], ["What to work on", cr.work_on]].forEach(([t, items]) => {
      if (!items?.length) return;
      doc.moveDown(0.4); p(t, { bold: true, size: 10.5 });
      items.forEach((x) => p(`•  ${x}`, { size: 10 }));
    });
    if (cr.focus_next_time) { doc.moveDown(0.4); p("Focus for next time", { bold: true, size: 10.5 }); p(cr.focus_next_time, { size: 10 }); }
  }

  // ---- 6. reminders
  h1(`${cr ? "6" : "5"}  Key reminders`);
  p("General guidance for every learner, not based on this session.", { size: 8.5, color: C.muted });
  doc.moveDown(0.3);
  REMINDERS.forEach(([b, t]) => { ensure(30); doc.font("Helvetica-Bold").fontSize(10).fillColor(C.ink).text(`${b} `, X, doc.y, { continued: true, width: W, lineGap: 2 }).font("Helvetica").text(t); doc.moveDown(0.35); });

  // ---- footer on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing in the margin must not start a new page
    const y = doc.page.height - 40;
    doc.font("Helvetica").fontSize(8).fillColor(C.muted)
      .text(`VPS Clinical · ${learner || ""} · ${scenario?.scenarioName || ""}`, X, y, { width: W - 60, lineBreak: false, ellipsis: true })
      .text(`${i + 1} / ${range.count}`, X + W - 60, y, { width: 60, align: "right", lineBreak: false });
  }
  doc.end();
}

