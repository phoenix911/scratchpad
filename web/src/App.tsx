import { useEffect } from "react";
import { useStore } from "./store";
import { Login } from "./components/Login";
import { AppShell } from "./components/AppShell";
import { ShareView } from "./components/ShareView";
import { setDateFavicon } from "./lib/favicon";

// Public share route — rendered without auth or app bootstrap.
const shareMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9]+)\/?$/);

export function App() {
  const auth = useStore((s) => s.auth);
  const init = useStore((s) => s.init);

  useEffect(() => {
    setDateFavicon(); // calendar tile with today's date
    if (shareMatch) return; // share view doesn't need the authed session
    void init();
  }, [init]);

  if (shareMatch) return <ShareView token={shareMatch[1]} />;

  if (auth === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="mono text-sm text-[var(--ink-faint)]">scratchpad</span>
      </div>
    );
  }
  return auth === "in" ? <AppShell /> : <Login />;
}
