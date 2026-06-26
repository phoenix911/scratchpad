import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

// Debounced autosave. Returns a `schedule(value)` to call on every change and a
// status for the UI. Flushes a pending save on unmount so nothing is lost.
export function useDebouncedSave<T>(
  save: (value: T) => Promise<void>,
  delay = 700,
): { schedule: (value: T) => void; status: SaveState } {
  const [status, setStatus] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<T | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (pending.current === null) return;
    const value = pending.current;
    pending.current = null;
    setStatus("saving");
    try {
      await saveRef.current(value);
      setStatus((s) => (s === "saving" ? "saved" : s));
    } catch {
      setStatus("error");
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = value;
      setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void flush(); // best-effort flush on unmount / item switch
    };
  }, [flush]);

  return { schedule, status };
}
