import { ja } from "./dictionary";

// Whole-platform DOM translator.
//
// React renders every screen in English (the source language). This module
// overlays Japanese onto the live DOM so the entire app switches languages
// without wrapping each component's strings. It:
//   - walks all text nodes and swaps any exact English phrase found in the
//     dictionary for its Japanese equivalent,
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

function translateTextNode(node) {
  const value = node.nodeValue;
  if (!value || !value.trim()) return;

  if (!originalText.has(node)) originalText.set(node, value);
  const orig = originalText.get(node);
  const key = orig.trim();

  if (currentLang === "ja") {
    const tr = ja[key];
    if (tr) {
      const next = orig.replace(key, tr);
      if (node.nodeValue !== next) node.nodeValue = next;
    }
  } else if (node.nodeValue !== orig) {
    node.nodeValue = orig;
  }
}

function translateAttrs(el) {
  if (el.nodeType !== 1) return;
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
    const key = orig.trim();

    if (currentLang === "ja") {
      const tr = ja[key];
      if (tr && value !== orig.replace(key, tr)) {
        el.setAttribute(attr, orig.replace(key, tr));
      }
    } else if (value !== orig) {
      el.setAttribute(attr, orig);
    }
  }
}

function walk(root) {
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  // Skip script/style subtrees.
  if (root.tagName === "SCRIPT" || root.tagName === "STYLE") return;

  translateAttrs(root);
  const iter = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n = iter.nextNode();
  while (n) {
    translateTextNode(n);
    n = iter.nextNode();
  }
  // Attributes on descendants
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
