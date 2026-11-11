// Account settings in the vx design (docs/DESIGN_SYSTEM.md). Same endpoints as before:
// PUT /api/auth/change-password and PUT /api/auth/change-email.
import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, Loader2, Mail, KeyRound } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { Segmented } from "../vx/ui";
import { useAuth } from "@/AuthContext.jsx";
import { Button, ButtonGroup, InputGroup, InputCell, Expand, Section, controlClass } from "../vx/ui";
import { cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";
const ROLE_LABEL = { student: "Student", educator: "Educator", school_admin: "School admin", superadmin: "Super admin" };

function PasswordCell({ label, id, value, onChange, autoComplete, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <InputCell label={label} htmlFor={id} className={cn(invalid && "bg-[rgb(var(--vx-danger)/0.08)]")}>
      <span className="flex items-center gap-2">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} className={cn(controlClass, "text-lg")} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
          className={cn("grid size-8 shrink-0 place-items-center rounded-full hover:bg-[rgb(var(--vx-bg))]", muted)}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </InputCell>
  );
}

const readPref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

/** Per-browser preferences. Theme and language apply at once; the others on the next page load. */
function Preferences({ role }) {
  const { language, toggleLanguage } = useLanguage();
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const [view, setView] = useState(() => readPref("vps.scenarios.view", "cards"));
  const [rows, setRows] = useState(() => readPref("vps.pageSize", "8"));
  const cell = (label, control) => (
    <InputCell as="div" label={label} className="flex-1">{control}</InputCell>
  );
  return (
    <Section title="Preferences" hint="Saved in this browser.">
      <div className="flex flex-col gap-0.5">
        <InputGroup>
          {cell("Theme", <Segmented label="Theme" value={theme} onChange={(t) => { setTheme(t); window.dispatchEvent(new CustomEvent("vps-theme", { detail: t })); }}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />)}
          {cell("Language", <Segmented label="Language" value={language} onChange={(l) => { if (l !== language) toggleLanguage(); }}
            options={[{ value: "en", label: "English" }, { value: "ja", label: "日本語" }]} />)}
        </InputGroup>
        {role !== "student" && (
          <InputGroup>
            {cell("Scenarios open as", <Segmented label="Scenarios view" value={view} onChange={(v) => { setView(v); writePref("vps.scenarios.view", v); }}
              options={[{ value: "cards", label: "Cards" }, { value: "table", label: "Table" }]} />)}
            {cell("Rows per page", <Segmented label="Rows per page" value={rows} onChange={(r) => { setRows(r); writePref("vps.pageSize", r); }}
              options={["8", "16", "32", "64"].map((n) => ({ value: n, label: n }))} />)}
          </InputGroup>
        )}
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const mismatch = !!pw.confirmPassword && pw.newPassword !== pw.confirmPassword;
  const pwReady = pw.currentPassword && pw.newPassword && pw.confirmPassword && !mismatch;

  const [emailOpen, setEmailOpen] = useState(false);
  const [em, setEm] = useState({ newEmail: "", password: "" });
  const [emBusy, setEmBusy] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!pwReady || pwBusy) return;
    setPwBusy(true);
    try {
      await axios.put("/api/auth/change-password", pw);
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the password.");
    } finally {
      setPwBusy(false);
    }
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!em.newEmail || !em.password || emBusy) return;
    setEmBusy(true);
    try {
      const { data } = await axios.put("/api/auth/change-email", em);
      updateProfile({ email: data.email });
      setEm({ newEmail: "", password: "" });
      setEmailOpen(false);
      toast.success("Email updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the email.");
    } finally {
      setEmBusy(false);
    }
  };

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex max-w-4xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

        {/* Name is set by whoever administers the account, so it is read-only here. */}
        <Section title="Account">
          <InputGroup>
            <InputCell as="div" label="Name" className="flex-1">
              <span className="truncate text-lg">{user?.name || "—"}</span>
            </InputCell>
            <InputCell as="div" label="Email" className="flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-lg">{user?.email || "—"}</span>
                {!emailOpen && (
                  <Button variant="soft" size="sm" onClick={() => setEmailOpen(true)}><Mail /> Change</Button>
                )}
              </span>
            </InputCell>
            {user?.role && (
              <InputCell as="div" label="Role" className="md:w-56">
                <span className="text-lg">{ROLE_LABEL[user.role] || user.role}</span>
              </InputCell>
            )}
          </InputGroup>

          <Expand open={emailOpen}>
            <form onSubmit={submitEmail} className="mt-4 flex flex-col gap-3">
              <InputGroup>
                <InputCell label="New email" htmlFor="set-email" className="flex-1">
                  <input id="set-email" type="email" autoComplete="email" value={em.newEmail}
                    onChange={(e) => setEm({ ...em, newEmail: e.target.value })} placeholder="name@example.com" className={cn(controlClass, "text-lg")} />
                </InputCell>
                <PasswordCell label="Your password" id="set-email-pw" autoComplete="current-password"
                  value={em.password} onChange={(v) => setEm({ ...em, password: v })} />
              </InputGroup>
              <div className="flex justify-end">
                <ButtonGroup>
                  <Button variant="secondary" size="lg" onClick={() => { setEmailOpen(false); setEm({ newEmail: "", password: "" }); }}>Cancel</Button>
                  <Button type="submit" size="lg" disabled={!em.newEmail || !em.password || emBusy}>
                    {emBusy ? <><Loader2 className="animate-spin" /> Saving</> : "Update email"}
                  </Button>
                </ButtonGroup>
              </div>
            </form>
          </Expand>
        </Section>

        <Preferences role={user?.role} />

        <Section title="Password">
          <form onSubmit={submitPassword} className="flex flex-col gap-3">
            <InputGroup vertical>
              <PasswordCell label="Current password" id="set-cur" autoComplete="current-password"
                value={pw.currentPassword} onChange={(v) => setPw({ ...pw, currentPassword: v })} />
              <PasswordCell label="New password" id="set-new" autoComplete="new-password"
                value={pw.newPassword} onChange={(v) => setPw({ ...pw, newPassword: v })} />
              <PasswordCell label="Confirm new password" id="set-conf" autoComplete="new-password" invalid={mismatch}
                value={pw.confirmPassword} onChange={(v) => setPw({ ...pw, confirmPassword: v })} />
            </InputGroup>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("px-1 text-sm", mismatch ? "text-[rgb(var(--vx-danger))]" : muted)} role={mismatch ? "alert" : undefined}>
                {mismatch ? "The new passwords don't match." : ""}
              </p>
              <Button type="submit" size="lg" disabled={!pwReady || pwBusy}>
                {pwBusy ? <><Loader2 className="animate-spin" /> Saving</> : <><KeyRound /> Update password</>}
              </Button>
            </div>
          </form>
        </Section>
      </div>
    </div>
  );
}
