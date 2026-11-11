import React, { useState } from "react";
import { useAuth } from "../../AuthContext";
import { AuthField, AuthGroup, AuthLayout } from "./auth/AuthPage";

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null); // { text, field?: "email" | "password" }
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr({ text: "Enter your email.", field: "email" });
    if (!/\S+@\S+\.\S+/.test(email)) return setErr({ text: "Enter a valid email address.", field: "email" });
    if (!password) return setErr({ text: "Enter your password.", field: "password" });
    setBusy(true);
    setErr(null);
    try {
      await login(email, password);
    } catch (error) {
      const data = error.response?.data;
      setErr({
        text: error.response?.status === 401
          ? "Wrong email or password."
          : data?.message || data?.error || data?.msg || error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" sub="Sign in to continue to your scenarios.">
      <form className="au-form" onSubmit={submit} noValidate>
        <AuthGroup error={err?.field ? err.text : undefined}>
          <AuthField label="Email" type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required
            value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} error={err?.field === "email" ? err.text : undefined} />
          <AuthField label="Password" type="password" name="password" autoComplete="current-password" required
            value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} error={err?.field === "password" ? err.text : undefined} />
        </AuthGroup>
        {err && !err.field && <div className="au-alert" role="alert">{err.text}</div>}
        <button className="au-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
