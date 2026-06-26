import { useEffect, useState } from "react";

interface Cornell {
  cues: string;
  notes: string;
  summary: string;
}

function parse(content: string): Cornell {
  if (content.trim()) {
    try {
      const d = JSON.parse(content);
      return { cues: d.cues ?? "", notes: d.notes ?? "", summary: d.summary ?? "" };
    } catch {
      /* fall through */
    }
  }
  return { cues: "", notes: "", summary: "" };
}

interface Props {
  docId: string;
  initialContent: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

// Cornell note-taking layout: a narrow cue/questions column, a wide notes
// column, and a summary band along the bottom. Stored as JSON.
export function CornellNote({ docId, initialContent, onChange, readOnly }: Props) {
  const [data, setData] = useState<Cornell>(() => parse(initialContent));

  useEffect(() => setData(parse(initialContent)), [docId]); // reset when the doc changes

  function update(patch: Partial<Cornell>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(JSON.stringify(next));
  }

  const ta =
    "flex-1 min-h-0 w-full resize-none bg-transparent px-4 pb-4 outline-none text-[14px] leading-7 text-[var(--ink)] placeholder:text-[var(--ink-faint)]";

  return (
    <div className="flex h-full flex-col bg-[var(--page)]">
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[32%] min-w-[180px] flex-col border-r border-[var(--line)]">
          <Label>Cue · Questions</Label>
          <textarea
            className={ta}
            readOnly={readOnly}
            value={data.cues}
            onChange={(e) => update({ cues: e.target.value })}
            placeholder="Questions, keywords, prompts…"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Label>Notes</Label>
          <textarea
            className={ta}
            readOnly={readOnly}
            value={data.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Main notes go here…"
          />
        </div>
      </div>
      <div className="flex h-[26%] min-h-[110px] flex-col border-t border-[var(--line)]">
        <Label>Summary</Label>
        <textarea
          className={ta}
          readOnly={readOnly}
          value={data.summary}
          onChange={(e) => update({ summary: e.target.value })}
          placeholder="Summarize in your own words…"
        />
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
      {children}
    </div>
  );
}
