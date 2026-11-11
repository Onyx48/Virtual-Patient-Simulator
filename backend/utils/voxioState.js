/**
 * Reads what Voxio keeps for a session into the shapes our dashboards use.
 *
 * Voxio's conversation histories hold the AI step's output as a Python dict
 * repr ({'speak': "...", 'movement': []}) and the student's turn as
 * "user_input : <text>". Both are turned back into plain text here.
 */
import { questionResults, toScore, fixParagraphs, toSelfRating, REFLECTION_STATUSES } from "./simEngine.js";
import { START_OF_REFLECTION, END_OF_REFLECTION } from "./simEngine.js";

/** Parse a Python literal (dict, list, str, number, True/False/None). Throws if it is not one. */
export const parsePythonLiteral = (text) => {
  let i = 0;
  const s = String(text);
  const ws = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  const value = () => {
    ws();
    const c = s[i];
    if (c === "{") {
      i++;
      const obj = {};
      ws();
      if (s[i] === "}") return i++, obj;
      for (;;) {
        const key = value();
        ws();
        if (s[i++] !== ":") throw new Error("expected :");
        obj[key] = value();
        ws();
        if (s[i] === ",") { i++; ws(); if (s[i] === "}") return i++, obj; continue; }
        if (s[i++] === "}") return obj;
        throw new Error("expected , or }");
      }
    }
    if (c === "[" || c === "(") {
      const close = c === "[" ? "]" : ")";
      i++;
      const arr = [];
      ws();
      if (s[i] === close) return i++, arr;
      for (;;) {
        arr.push(value());
        ws();
        if (s[i] === ",") { i++; ws(); if (s[i] === close) return i++, arr; continue; }
        if (s[i++] === close) return arr;
        throw new Error("expected , or ]");
      }
    }
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      let out = "";
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\") {
          const n = s[++i];
          const map = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"' };
          if (n === "u" || n === "x") {
            const len = n === "u" ? 4 : 2;
            out += String.fromCharCode(parseInt(s.slice(i + 1, i + 1 + len), 16));
            i += len;
          } else out += map[n] ?? n;
          i++;
        } else out += s[i++];
      }
      if (s[i++] !== q) throw new Error("unterminated string");
      return out;
    }
    const word = s.slice(i).match(/^(True|False|None|-?\d+(\.\d+)?([eE][-+]?\d+)?)/);
    if (!word) throw new Error(`unexpected ${c}`);
    i += word[0].length;
    return word[0] === "True" ? true : word[0] === "False" ? false : word[0] === "None" ? null : Number(word[0]);
  };
  const v = value();
  ws();
  if (i !== s.length) throw new Error("trailing text");
  return v;
};

/** An AI step's stored output as an object: JSON, a Python dict repr, or null. */
export const parseStoredOutput = (content) => {
  const raw = String(content ?? "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return parsePythonLiteral(raw);
    } catch {
      return null;
    }
  }
};

/** "user_input : text" (one "name : value" line per input) -> the user_input text. */
const userText = (content) => {
  const raw = String(content ?? "");
  const m = raw.match(/(?:^|\n)user_input\s*:\s*([\s\S]*?)(?=\n[a-z_]+\s*:\s|$)/);
  return (m ? m[1] : raw).trim();
};

/** A Voxio history as [{role, content}] of what was actually said. */
export const cleanHistory = (history, { spokenKey = "speak" } = {}) =>
  (Array.isArray(history) ? history : [])
    .filter((t) => t && (t.role === "user" || t.role === "assistant"))
    .map((t) => {
      if (t.role === "user") return { role: "user", content: userText(t.content) };
      const out = parseStoredOutput(t.content);
      const said = out ? out[spokenKey] ?? out.speak ?? out.response : t.content;
      return { role: "assistant", content: String(said ?? "").trim() };
    })
    .filter((t) => t.content);

/** The consultation, without the hidden end-of-session turn. */
export const transcriptOf = (state) => cleanHistory(state?.diagnosis_conversation_history);

/** Feedback, score and per-question verdicts, or null while grading is still running. */
export const gradingOf = (state, questionList) => {
  const feedback = typeof state?.feedback === "string" ? state.feedback.trim() : "";
  if (!feedback) return null;
  let questions = state.questions;
  if (typeof questions === "string") questions = parseStoredOutput(`{"q": ${questions}}`)?.q ?? [];
  return {
    feedback: fixParagraphs(feedback),
    score: toScore(state.score),
    question_results: questionResults(questionList, questions),
  };
};

/** The self-reflection result, or null until [END_OF_REFLECTION] has been processed. */
export const reflectionOf = (state) => {
  if (String(state?.reflection_done).toLowerCase() !== "yes") return null;
  if (!REFLECTION_STATUSES.includes(String(state.status))) return null;
  const summary = String(state.summary ?? "").trim();
  return {
    self_rating: toSelfRating(state.self_rating),
    summary: summary && summary !== "None" && summary !== "null" ? summary : null,
    status: String(state.status),
    distress_flag: state.distress_flag === true || String(state.distress_flag).toLowerCase() === "true",
  };
};

/** The reflection conversation, without the control markers. */
export const reflectionTurnsOf = (state) =>
  cleanHistory(state?.reflection_conversation_history).filter(
    (t) => !t.content.startsWith(START_OF_REFLECTION) && t.content !== END_OF_REFLECTION,
  );

export const reasoningTurnsOf = (state) => cleanHistory(state?.reasoning_conversation_history);

/** The Clinical Reasoning engine's result ({ status, feedback }), or null until it has run. */
export const reasoningOf = (state) => {
  const raw = state?.cr_feedback;
  if (!raw) return null;
  let fb = raw;
  if (typeof raw === "string") {
    try { fb = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { fb = parseStoredOutput(raw); }
  }
  if (!fb || typeof fb !== "object") return null;
  return { status: String(state.cr_status || fb.status || "") || null, feedback: fb };
};
