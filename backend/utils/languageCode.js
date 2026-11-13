/**
 * ISO 639-1 code ("en", "ja", "hi", ..., plus "zh-Hant" / "zh-Hans" for Chinese script) for a scenario's language. The AI
 * prompts set `language` to the English name ("Japanese"), so this maps that
 * name, or a code that is already a code, to the two-letter form. Built from
 * Intl so every language ICU knows is covered, not just the ones we prompt for.
 */
const names = new Intl.DisplayNames(["en"], { type: "language" });

const NAME_TO_CODE = new Map();
for (let a = 97; a <= 122; a++) {
  for (let b = 97; b <= 122; b++) {
    const code = String.fromCharCode(a, b);
    try {
      const name = names.of(code);
      if (name && name !== code) NAME_TO_CODE.set(name.toLowerCase(), code);
    } catch {
      /* not a language code */
    }
  }
}

export const languageCodeFor = (language) => {
  const value = String(language || "").trim().toLowerCase();
  if (!value) return "";
  // Already a code, e.g. "ja" or "en-US".
  const primary = value.split(/[-_]/)[0];
  if (/^[a-z]{2}$/.test(primary) && NAME_TO_CODE.has(names.of(primary)?.toLowerCase())) {
    return primary;
  }
  // Chinese script variants: "Chinese (Traditional)" -> zh-Hant.
  if (/^(chinese|mandarin)\b/.test(value)) {
    if (/tradition|繁/.test(value)) return "zh-Hant";
    if (/simplif|简/.test(value)) return "zh-Hans";
  }
  // "Japanese", or "Japanese (Japan)".
  return NAME_TO_CODE.get(value) || NAME_TO_CODE.get(value.replace(/\s*\(.*\)$/, "")) || "";
};
