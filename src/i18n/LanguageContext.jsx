import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { applyLanguage } from "./domTranslator";

// Translation dictionary. Keys are stable identifiers; each maps to the
// English and Japanese strings. Extend this as more of the UI is localized.
export const translations = {
  en: {
    // Sidebar / navigation
    "nav.mainMenu": "Main Menu",
    "nav.helpSupport": "Help & Support",
    "nav.dashboard": "Dashboard",
    "nav.schools": "Schools",
    "nav.scenarios": "Scenarios",
    "nav.students": "Students",
    "nav.educators": "Educators",
    "nav.courses": "Courses",
    "nav.myCourses": "My Courses",
    "nav.createRoom": "Create Room",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    // Header page titles
    "page.dashboard": "Dashboard",
    "page.schools": "Schools Management",
    "page.scenarios": "Scenarios Management",
    "page.students": "Students Management",
    "page.settings": "Account Settings",
    "header.search": "Search...",

    // Roles
    "role.superadmin": "Super Admin",
    "role.educator": "Educator",
    "role.school_admin": "School Admin",
    "role.student": "Student",

    // Common actions
    "common.language": "日本語",
  },
  ja: {
    // Sidebar / navigation
    "nav.mainMenu": "メインメニュー",
    "nav.helpSupport": "ヘルプとサポート",
    "nav.dashboard": "ダッシュボード",
    "nav.schools": "学校",
    "nav.scenarios": "シナリオ",
    "nav.students": "学生",
    "nav.educators": "教育者",
    "nav.courses": "コース",
    "nav.myCourses": "マイコース",
    "nav.createRoom": "ルームを作成",
    "nav.settings": "設定",
    "nav.logout": "ログアウト",

    // Header page titles
    "page.dashboard": "ダッシュボード",
    "page.schools": "学校管理",
    "page.scenarios": "シナリオ管理",
    "page.students": "学生管理",
    "page.settings": "アカウント設定",
    "header.search": "検索...",

    // Roles
    "role.superadmin": "スーパー管理者",
    "role.educator": "教育者",
    "role.school_admin": "学校管理者",
    "role.student": "学生",

    // Common actions
    "common.language": "English",
  },
};

const LanguageContext = createContext(null);

const STORAGE_KEY = "app_language";

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "ja" || saved === "en" ? saved : "en";
    } catch {
      return "en";
    }
  });

  // Run the whole-platform DOM translator whenever the language changes.
  // A double rAF lets React finish committing the current render (and any
  // route/lazy content) before we overlay Japanese onto the live DOM.
  useEffect(() => {
    let raf1;
    let raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => applyLanguage(language));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const next = prev === "en" ? "ja" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
      return next;
    });
  }, []);

  // t(key) returns the translation for the current language, falling back to
  // the key itself (then English) so missing entries never break the UI.
  const t = useCallback(
    (key) => translations[language]?.[key] ?? translations.en?.[key] ?? key,
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
