import { useEffect } from "react";
import { useStore } from "./store";
import { Login } from "./components/Login";
import { AppShell } from "./components/AppShell";

export function App() {
  const auth = useStore((s) => s.auth);
  const init = useStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (auth === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="mono text-sm text-[var(--ink-faint)]">scratchpad</span>
      </div>
    );
  }
  return auth === "in" ? <AppShell /> : <Login />;
}
