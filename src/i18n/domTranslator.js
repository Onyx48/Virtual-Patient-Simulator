import { ja } from "./dictionary";

// Whole-platform DOM translator.
//
// React renders every screen in English (the source language). This module
// overlays Japanese onto the live DOM so the entire app switches languages
// without wrapping each component's strings. It:
//   - replaces every English phrase/word found in the dictionary with its
//     Japanese equivalent, even when it is mixed with dynamic content
//     (e.g. "8 increased vs last month"),
//   - remembers each node's original English so switching back restores it,
//   - watches for dynamically-rendered content via a MutationObserver,
//   - also translates input placeholders and title attributes.
//
// Our own DOM writes are made with the observer disconnected, so every change
// the observer *does* see comes from React (i.e. fresh English), which lets us
// keep the original-text cache in sync with dynamic updates.

const originalText = new WeakMap(); // text node -> original English nodeValue
const originalAttr = new WeakMap(); // element -> { placeholder?, title? }

let currentLang = "en";
let observer = null;

const ATTRS = ["placeholder", "title"];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const dictKeys = Object.keys(ja).filter((k) => k.trim().length > 0);

// Exact whole-node lookup (case-insensitive) — labels, buttons, headings.
// Safe: only fires when the entire cell equals a known phrase.
const exactMap = new Map(dictKeys.map((k) => [k.trim().toLowerCase(), ja[k]]));

// All keys as boundary-anchored regexes, longest first, for substring passes.
const compiled = dictKeys
  .sort((a, b) => b.length - a.length)
  .map((key) => ({
    re: new RegExp(
      `(?<![A-Za-z0-9])${escapeRegExp(key.trim())}(?![A-Za-z0-9])`,
      "gi",
    ),
    jp: ja[key],
  }));

const HAS_LETTER = /[A-Za-z]/;

// Elements marked with [data-no-i18n] (and their subtree) are never touched —
// e.g. the language switcher itself.
function isExcluded(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !!el && !!el.closest && !!el.closest("[data-no-i18n]");
}

// Translate an English string, guaranteeing no half-translated output:
//   1. exact whole-node match wins immediately (handles all labels/buttons);
//   2. otherwise replace every known phrase/word as a substring, but KEEP the
//      result only if no English letters remain — so counts like
//      "8 increased vs last month" fully translate, while a real sentence with
//      any unknown word (e.g. "View all your data") is left entirely English.
//      Either fully Japanese or fully English — never mixed.
function translateString(orig) {
  const trimmed = orig.trim();
  const exact = exactMap.get(trimmed.toLowerCase());
  if (exact !== undefined) return orig.replace(trimmed, exact);

  let out = orig;
  for (const { re, jp } of compiled) {
    re.lastIndex = 0;
    if (re.test(out)) {
      re.lastIndex = 0;
      out = out.replace(re, jp);
    }
  }
  // Reject partial translations: if any English word survived, leave English.
  return HAS_LETTER.test(out) ? orig : out;
}

function translateTextNode(node) {
  const value = node.nodeValue;
  if (!value || !value.trim()) return;
  if (isExcluded(node)) return;

  if (!originalText.has(node)) originalText.set(node, value);
  const orig = originalText.get(node);

  const next = currentLang === "ja" ? translateString(orig) : orig;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function translateAttrs(el) {
  if (el.nodeType !== 1) return;
  if (isExcluded(el)) return;
  let cache = originalAttr.get(el);
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const value = el.getAttribute(attr);
    if (!value || !value.trim()) continue;

    if (!cache) {
      cache = {};
      originalAttr.set(el, cache);
    }
    if (!(attr in cache)) cache[attr] = value;
    const orig = cache[attr];

    const next = currentLang === "ja" ? translateString(orig) : orig;
    if (value !== next) el.setAttribute(attr, next);
  }
}

function walk(root) {
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  if (root.tagName === "SCRIPT" || root.tagName === "STYLE") return;

  translateAttrs(root);
  const iter = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n = iter.nextNode();
  while (n) {
    translateTextNode(n);
    n = iter.nextNode();
  }
  root.querySelectorAll?.("input, textarea, [title]").forEach(translateAttrs);
}

function withObserverPaused(fn) {
  if (observer) observer.disconnect();
  try {
    fn();
  } finally {
    if (observer) startObserving();
  }
}

function startObserving() {
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      withObserverPaused(() => {
        for (const m of mutations) {
          if (m.type === "characterData") {
            // React wrote fresh English into this text node.
            originalText.set(m.target, m.target.nodeValue);
            translateTextNode(m.target);
          } else if (m.type === "attributes" && m.target.nodeType === 1) {
            const cache = originalAttr.get(m.target);
            if (cache && m.attributeName in cache) {
              cache[m.attributeName] = m.target.getAttribute(m.attributeName);
            }
            translateAttrs(m.target);
          } else {
            m.addedNodes.forEach((node) => walk(node));
          }
        }
      });
    });
  }
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}

// Public: set the active language and (re)translate the whole document.
export function applyLanguage(lang) {
  currentLang = lang === "ja" ? "ja" : "en";
  if (typeof document === "undefined") return;
  withObserverPaused(() => walk(document.body));
  startObserving();
}
