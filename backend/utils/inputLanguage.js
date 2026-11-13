/**
 * Which language a scenario brief is written in, from its script alone, so the
 * generated scenario comes out in the same language.
 *
 * Script is reliable for everything except Latin: English, Malay, Spanish and
 * romanised Hindi all look alike, so Latin text is treated as English. A
 * Japanese or Chinese brief that quotes an English term ("SLR") still counts as
 * Japanese or Chinese, because any of their characters decides it.
 *
 * Returns { key: "en" | "ja" | "generic", name, scriptRule }.
 *   - "en" and "ja" have hand-written prompt sections (exact translations of
 *     every fixed string). Everything else uses language-generic.md.
 *   - `name` is what the model is told and what it writes into `language`, so it
 *     must be a name languageCode.js can map ("Hindi", "Chinese (Traditional)").
 */

// Characters that exist only in Traditional or only in Simplified Chinese,
// taken from very common words, so even a short brief usually contains some.
const TRADITIONAL_ONLY = /[這們個來說時會為與學國語見關點從經過還對開後東車長門問題體讓萬給錢樓蓋歲頭醫療髮動腳傷處應該]/g;
const SIMPLIFIED_ONLY = /[这们个来说时会为与学国语见关点从经过还对开后东车长门问题体让万给钱头医疗发动脚伤处应该楼盖岁]/g;

const SCRIPTS = [
  // Order matters: kana before Han (Japanese uses kanji too).
  { re: /[぀-ヿｦ-ﾟ]/, key: "ja", name: "Japanese" },
  { re: /[가-힯ᄀ-ᇿ]/, name: "Korean" },
  { re: /[一-鿿㐀-䶿]/, chinese: true },
  { re: /[ऀ-ॿ]/, name: "Hindi" },
  { re: /[ঀ-৿]/, name: "Bengali" },
  { re: /[਀-੿]/, name: "Punjabi" },
  { re: /[઀-૿]/, name: "Gujarati" },
  { re: /[஀-௿]/, name: "Tamil" },
  { re: /[ఀ-౿]/, name: "Telugu" },
  { re: /[ಀ-೿]/, name: "Kannada" },
  { re: /[ഀ-ൿ]/, name: "Malayalam" },
  { re: /[฀-๿]/, name: "Thai" },
  { re: /[؀-ۿ]/, name: "Arabic" },
  { re: /[֐-׿]/, name: "Hebrew" },
  { re: /[Ѐ-ӿ]/, name: "Russian" },
  { re: /[Ͱ-Ͽ]/, name: "Greek" },
];

const count = (text, re) => (text.match(re) || []).length;

export const detectInputLanguage = (text) => {
  const t = String(text || "");
  for (const s of SCRIPTS) {
    if (!s.re.test(t)) continue;
    if (s.key === "ja") return { key: "ja", name: "Japanese", scriptRule: "" };
    if (s.chinese) {
      const traditional = count(t, TRADITIONAL_ONLY) > count(t, SIMPLIFIED_ONLY);
      const name = traditional ? "Chinese (Traditional)" : "Chinese (Simplified)";
      return {
        key: "generic",
        name,
        scriptRule: traditional
          ? "Write Mandarin Chinese in **Traditional characters only** (繁體中文) — never Simplified."
          : "Write Mandarin Chinese in **Simplified characters only** (简体中文).",
      };
    }
    return {
      key: "generic",
      name: s.name,
      scriptRule: s.name === "Hindi" ? "Write in Devanagari script (not romanised Hindi)." : "",
    };
  }
  return { key: "en", name: "English", scriptRule: "" };
};
