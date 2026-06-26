import { useState } from "react";
import { useStore } from "../store";
import { ApiError } from "../lib/api";

export function Login() {
  const login = useStore((s) => s.login);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(password);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Wrong password" : "Couldn't sign in");
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-6">
      <form onSubmit={submit} className="pop-in w-full max-w-xs">
        <div className="mb-7 text-center">
          <div className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">scratchpad</div>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Your private workspace.</p>
        </div>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--raised)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          placeholder="Password"
        />
        {error && <p className="mt-2 text-[12px] text-[var(--danger)]">{error}</p>}
        <button type="submit" disabled={busy} className="btn-brutal mt-4 w-full px-4 py-2.5 text-[13px]">
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
