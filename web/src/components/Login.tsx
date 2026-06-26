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
      <form onSubmit={submit} className="pop-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mono text-2xl font-semibold tracking-tight">
            scratchpad<span className="caret" />
          </div>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Your private workshop.</p>
        </div>

        <label className="mono mb-2 block text-xs uppercase tracking-widest text-[var(--ink-faint)]">
          Password
        </label>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mono w-full rounded-[var(--radius)] border border-[var(--edge)] bg-[var(--paper-raised)] px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--accent-line)]"
          placeholder="••••••••"
        />

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-[var(--radius)] bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
