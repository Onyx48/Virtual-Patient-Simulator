// Shared shell for sign-in and sign-up, after vx/website/web's AuthPage: a brand panel beside a
// centred card, connected fields, one submit. Colours: docs/DESIGN_SYSTEM.md.
import React, { useState } from "react";
import { Eye, EyeOff, MessageSquare, Activity, ClipboardCheck } from "lucide-react";
import brandImage from "../Login-bg.jpg";
import "./auth.css";

const POINTS = [
  { icon: MessageSquare, text: "Talk to realistic virtual patients" },
  { icon: Activity, text: "Ask for movements and see them" },
  { icon: ClipboardCheck, text: "Feedback and clinical reasoning after every session" },
];

const Logo = ({ small }) => (
  <span className={`au-logo${small ? " au-logo-sm" : ""}`}><span className="au-mark">VPS</span>VPS Clinical</span>
);

export function AuthLayout({ title, sub, children, foot }) {
  return (
    <div className="au">
      <aside className="au-brand" style={{ backgroundImage: `url(${brandImage})` }}>
        <Logo />
        <div className="au-pitch">
          <h2>Practise history taking before the clinic.</h2>
          <ul>
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text}><span><Icon size={18} /></span>{text}</li>
            ))}
          </ul>
        </div>
        <p className="au-small">© VPS Clinical</p>
      </aside>
      <main className="au-main">
        <div className="au-card">
          <Logo small />
          <h1>{title}</h1>
          <p className="au-sub">{sub}</p>
          {children}
          {foot && <p className="au-foot">{foot}</p>}
        </div>
      </main>
    </div>
  );
}

/** Connected fields. A cell's error only tints it; the message sits under the whole group. */
export function AuthGroup({ error, children }) {
  return (
    <div className="au-groupwrap">
      <div className="au-group" role="group">{children}</div>
      {error && <em className="au-grouperr" role="alert">{error}</em>}
    </div>
  );
}

export function AuthField({ label, error, ...input }) {
  const [shown, setShown] = useState(false);
  const isPw = input.type === "password";
  return (
    <label className={`au-field${error ? " has-err" : ""}`}>
      <span>{label}</span>
      <span className="au-inputwrap">
        <input {...input} type={isPw && shown ? "text" : input.type} aria-invalid={!!error} />
        {isPw && (
          <button type="button" className="au-eye" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"}>
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </label>
  );
}
