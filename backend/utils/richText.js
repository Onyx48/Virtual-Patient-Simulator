/**
 * Undo the HTML entity escaping the rich-text editor applies to prompt fields.
 *
 * Quill 2's getSemanticHTML() rewrites every space as &nbsp; and every quote as
 * &#39; / &quot;. Those fields are handed to an LLM as a system prompt, so the
 * entities land in the model's context as literal noise. The frontend now opts
 * out via useSemanticHTML={false}, but every scenario saved before that fix is
 * already stored escaped, so anything serving these fields to an outside
 * consumer normalises on read instead of requiring a migration.
 *
 * Tags are deliberately left alone — the editor is a rich-text field and the
 * external simulator already receives markup. Only the text is repaired.
 */
const ENTITIES = [
  [/&nbsp;/g, " "],
  // U+00A0, the literal non-breaking space character. Some records hold that
  // rather than the entity; an LLM should see a plain space either way. Built
  // from a charcode so no invisible character sits in this source file.
  [new RegExp(String.fromCharCode(160), "g"), " "],
  [/&#39;/g, "'"],
  [/&apos;/g, "'"],
  [/&#x27;/g, "'"],
  [/&quot;/g, '"'],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
];

export const decodeEntities = (value) => {
  if (typeof value !== "string" || !value) return value;

  let out = value;
  for (const [pattern, replacement] of ENTITIES) {
    out = out.replace(pattern, replacement);
  }

  // &amp; last: doing it earlier would turn "&amp;nbsp;" into a real space
  // instead of the literal "&nbsp;" the author typed.
  out = out.replace(/&amp;/g, "&");

  // Collapsing runs of spaces is safe now that &nbsp; is gone, and stops the
  // prompt carrying long whitespace gaps from the editor.
  return out.replace(/ {2,}/g, " ");
};

/** A copy of a scenario with its prompt fields readable. */
export const decodeScenarioText = (scenario) => {
  if (!scenario) return scenario;

  return {
    ...scenario,
    scenarioPrompt: decodeEntities(scenario.scenarioPrompt),
    aiQuestions: decodeEntities(scenario.aiQuestions),
    aiInstructions: decodeEntities(scenario.aiInstructions),
    description: decodeEntities(scenario.description),
  };
};
