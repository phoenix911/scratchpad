import { useEffect } from "react";
import { useStore } from "../store";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { CommandPalette } from "./CommandPalette";
import { PanelIcon } from "./icons";

export function AppShell() {
  const { setPalette, paletteOpen, sidebarCollapsed, toggleSidebar } = useStore();

  // ⌘K / Ctrl-K palette, ⌘\ toggles the sidebar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!useStore.getState().paletteOpen);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        useStore.getState().toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <main className="relative min-w-0 flex-1">
        <Workspace />
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Open sidebar (⌘\)"
            className="fixed right-3 top-3 z-20 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--raised)] p-1.5 text-[var(--ink-soft)] shadow-sm transition hover:text-[var(--ink)]"
          >
            <PanelIcon size={16} />
          </button>
        )}
      </main>
      {!sidebarCollapsed && <Sidebar />}
      {paletteOpen && <CommandPalette />}
    </div>
  );
}
