import { useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { api } from "@/lib/api";

interface Props {
  docId: string;
  initialContent: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
}

// Upload an image file and insert it at the cursor.
async function insertImage(editor: Editor, file: File) {
  try {
    const url = await api.uploadImage(file);
    editor.chain().focus().setImage({ src: url }).run();
  } catch {
    /* ignore failed upload */
  }
}

function imageFiles(list: FileList | DataTransferItemList | null): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as File | DataTransferItem;
    const file = "getAsFile" in item ? item.getAsFile() : item;
    if (file && file.type.startsWith("image/")) out.push(file);
  }
  return out;
}

// Rich-text document (Tiptap / ProseMirror). Stored as HTML (git-diffable,
// rendered directly in the share view). Markdown-style input rules from
// StarterKit make it feel native ("# " → heading, "- " → list, etc.).
export function TiptapEditor({ docId, initialContent, onChange, readOnly }: Props) {
  const editor = useEditor(
    {
      extensions: [StarterKit, Image.configure({ inline: false })],
      content: initialContent || "<p></p>",
      editable: !readOnly,
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
      editorProps: {
        attributes: { class: "tiptap-content" },
        handlePaste: (_view, event) => {
          const files = imageFiles(event.clipboardData?.items ?? null);
          if (files.length === 0) return false;
          event.preventDefault();
          files.forEach((f) => insertImage(editorRef.current!, f));
          return true;
        },
        handleDrop: (_view, event) => {
          const files = imageFiles((event as DragEvent).dataTransfer?.files ?? null);
          if (files.length === 0) return false;
          event.preventDefault();
          files.forEach((f) => insertImage(editorRef.current!, f));
          return true;
        },
      },
    },
    [docId],
  );
  // Keep a stable ref so the paste/drop handlers (captured at init) reach the editor.
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  return (
    <div className="flex h-full flex-col">
      {!readOnly && editor && <Toolbar editor={editor} />}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="mx-auto h-full max-w-3xl px-8 py-6" />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `rounded-[5px] px-2 py-1 text-[12px] transition hover:bg-[var(--hover)] ${
      active ? "bg-[var(--active)] text-[var(--ink)]" : "text-[var(--ink-soft)]"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--line)] px-3 py-1.5">
      <button className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
      <button className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <Sep />
      <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>{"</>"}</button>
      <Sep />
      <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
      <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
      <button className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
      <button className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Code</button>
    </div>
  );
}

const Sep = () => <span className="mx-1 h-4 w-px bg-[var(--line)]" />;
