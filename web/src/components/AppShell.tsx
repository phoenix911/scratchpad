import { useEffect } from "react";
import { useStore } from "../store";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { CommandPalette } from "./CommandPalette";

export function AppShell() {
  const setPalette = useStore((s) => s.setPalette);
  const paletteOpen = useStore((s) => s.paletteOpen);

  // Global ⌘K / Ctrl-K to toggle the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!useStore.getState().paletteOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Workspace />
      </main>
      {paletteOpen && <CommandPalette />}
    </div>
  );
}
