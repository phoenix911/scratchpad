import { useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

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
      // legacy plain-text note: drop it all in the notes column
      return { cues: "", notes: content, summary: "" };
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

// Cornell note: cue/questions column, notes column, summary band. Each area is a
// small Tiptap field, so basic Markdown auto-formats as you type (# headings,
// - / 1. lists, **bold**, etc.). Stored as JSON of HTML.
export function CornellNote({ docId, initialContent, onChange, readOnly }: Props) {
  const parsed = useMemo(() => parse(initialContent), [docId]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = useRef<Cornell>(parsed);
  const lastDoc = useRef(docId);
  if (lastDoc.current !== docId) {
    // reset the accumulator when switching documents
    lastDoc.current = docId;
    data.current = parsed;
  }

  function update(key: keyof Cornell, html: string) {
    data.current = { ...data.current, [key]: html };
    onChange?.(JSON.stringify(data.current));
  }

  return (
    <div className="flex h-full flex-col bg-[var(--page)]">
      <div className="flex min-h-0 flex-1">
        <Field
          docId={docId}
          value={parsed.cues}
          readOnly={readOnly}
          placeholder="Questions, keywords, prompts…"
          label="Cue · Questions"
          className="w-[32%] min-w-[180px] border-r border-[var(--line)]"
          onChange={(h) => update("cues", h)}
        />
        <Field
          docId={docId}
          value={parsed.notes}
          readOnly={readOnly}
          placeholder="Main notes go here…"
          label="Notes"
          className="min-w-0 flex-1"
          onChange={(h) => update("notes", h)}
        />
      </div>
      <Field
        docId={docId}
        value={parsed.summary}
        readOnly={readOnly}
        placeholder="Summarize in your own words…"
        label="Summary"
        className="h-[26%] min-h-[110px] border-t border-[var(--line)]"
        onChange={(h) => update("summary", h)}
      />
    </div>
  );
}

function Field({
  docId,
  value,
  onChange,
  readOnly,
  placeholder,
  label,
  className,
}: {
  docId: string;
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const editor = useEditor(
    {
      extensions: [StarterKit, Placeholder.configure({ placeholder })],
      content: value || "",
      editable: !readOnly,
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      editorProps: { attributes: { class: "tiptap-content" } },
    },
    [docId],
  );

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <div className="px-4 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
