import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  NotebookPen, PanelLeftClose, PanelLeftOpen, Type, Plus, GripVertical, Pencil, Trash2,
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, Baseline, Highlighter,
  Link2, Unlink, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  IndentDecrease, IndentIncrease, Subscript, Superscript, Minus, RemoveFormatting,
} from "lucide-react";
import type { OrdoNote } from "../types";
import { newNote } from "../lib/ordo";
import { lsGet, lsSet } from "../lib/store";
import { PanelChrome, HeaderIconBtn } from "./PanelChrome";

interface Props {
  notes: OrdoNote[];
  activeId: string;
  onChange: (notes: OrdoNote[], activeId?: string) => void;
}

const BLOCKS = [
  { value: "P", label: "Normal" },
  { value: "H1", label: "Título 1" },
  { value: "H2", label: "Título 2" },
  { value: "H3", label: "Título 3" },
  { value: "BLOCKQUOTE", label: "Citação" },
  { value: "PRE", label: "Código" },
];

const FONTS: { label: string; value: string }[] = [
  { label: "Padrão", value: "Inter, sans-serif" },
  { label: "Display", value: "'Space Grotesk', sans-serif" },
  { label: "Serifa", value: "'Newsreader', Georgia, serif" },
  { label: "Mono", value: "'JetBrains Mono', monospace" },
  { label: "Manuscrita", value: "'Caveat', cursive" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', monospace" },
];

const TB = ({
  label, active = false, onClick, children,
}: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-all active:scale-90 ${
      active
        ? "border-acid-500/50 bg-acid-400/15 text-acid-300"
        : "border-transparent text-carbon-300 hover:border-carbon-600 hover:bg-carbon-700/60 hover:text-white"
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-carbon-700" />;

const selCls =
  "h-7 shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 text-[11.5px] font-medium text-carbon-200 outline-none transition-colors hover:border-carbon-600 hover:bg-carbon-700/60 focus:border-carbon-600 [&>option]:bg-carbon-800 [&>option]:text-white";

function NotesPanelInner({ notes, activeId, onChange }: Props) {
  const [sbOpen, setSbOpen] = useState(() => lsGet("ordo:ui:notes-sb") !== "0");
  const [tbOpen, setTbOpen] = useState(() => lsGet("ordo:ui:notes-tb") !== "0");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [words, setWords] = useState(0);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [blockVal, setBlockVal] = useState("P");
  const [sizeVal, setSizeVal] = useState<number | "">("");
  const [fontVal, setFontVal] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const dragIdx = useRef<number | null>(null);

  const notesRef = useRef(notes);
  const activeIdRef = useRef(activeId);
  const onChangeRef = useRef(onChange);
  useEffect(() => { notesRef.current = notes; });
  useEffect(() => { activeIdRef.current = activeId; });
  useEffect(() => { onChangeRef.current = onChange; });

  /* ---- editor <-> state sync ---- */
  const sync = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.innerHTML;
    const id = activeIdRef.current;
    const arr = notesRef.current.map((n) => (n.id === id ? { ...n, content: html } : n));
    onChangeRef.current(arr);
    const t = ed.innerText.trim();
    setWords(t ? t.split(/\s+/).filter(Boolean).length : 0);
  }, []);

  /* load note into editor on switch */
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const note = notesRef.current.find((n) => n.id === activeId);
    ed.innerHTML = note?.content ?? "";
    savedRange.current = null;
    const t = ed.innerText.trim();
    setWords(t ? t.split(/\s+/).filter(Boolean).length : 0);
    setTimeout(() => ed.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    const ed = editorRef.current;
    if (!sel || !ed || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (ed.contains(r.commonAncestorContainer)) savedRange.current = r.cloneRange();
  }, []);

  const updateStates = useCallback(() => {
    saveRange();
    try {
      setActiveStates({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        subscript: document.queryCommandState("subscript"),
        superscript: document.queryCommandState("superscript"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
        justifyFull: document.queryCommandState("justifyFull"),
      });
      const bv = (document.queryCommandValue("formatBlock") || "P").toUpperCase();
      setBlockVal(BLOCKS.some((b) => b.value === bv) ? bv : "P");
      const fv = document.queryCommandValue("fontName") || "";
      setFontVal(fv);
      const sel = window.getSelection();
      let node: Node | null = sel?.anchorNode ?? null;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      if (node instanceof Element && editorRef.current?.contains(node)) {
        setSizeVal(Math.round(parseFloat(getComputedStyle(node).fontSize)));
      }
    } catch { /* commands unsupported */ }
  }, [saveRange]);

  useEffect(() => {
    const onSel = () => {
      const ed = editorRef.current;
      const sel = window.getSelection();
      if (!ed || !sel || sel.rangeCount === 0) return;
      if (ed.contains(sel.getRangeAt(0).commonAncestorContainer)) updateStates();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [updateStates]);

  const restoreAndFocus = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const r = savedRange.current;
    const sel = window.getSelection();
    if (r && ed.contains(r.commonAncestorContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(r);
    } else if (sel && (sel.rangeCount === 0 || !ed.contains(sel.getRangeAt(0).commonAncestorContainer))) {
      // sem seleção válida: coloca o cursor no fim
      const end = document.createRange();
      end.selectNodeContents(ed);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
    }
  }, []);

  const exec = useCallback(
    (cmd: string, val?: string) => {
      restoreAndFocus();
      document.execCommand(cmd, false, val);
      updateStates();
      sync();
    },
    [restoreAndFocus, sync, updateStates]
  );

  const applyFontSize = useCallback(
    (px: number) => {
      const ed = editorRef.current;
      if (!ed || !px || px < 6 || px > 400) return;
      restoreAndFocus();
      document.execCommand("fontSize", false, "7");
      // modo normal: <font size="7">; modo styleWithCSS: <span style="font-size: xxx-large">
      ed.querySelectorAll('font[size="7"]').forEach((f) => {
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;
        while (f.firstChild) span.appendChild(f.firstChild);
        f.replaceWith(span);
      });
      ed.querySelectorAll("span").forEach((s) => {
        if (s.style.fontSize === "xxx-large" || s.style.fontSize === "-webkit-xxx-large") {
          s.style.fontSize = `${px}px`;
        }
      });
      setSizeVal(px);
      updateStates();
      sync();
    },
    [restoreAndFocus, sync, updateStates]
  );

  const applyHighlight = useCallback(
    (color: string) => {
      restoreAndFocus();
      try { document.execCommand("styleWithCSS", false, "true"); } catch { /* ignore */ }
      try { document.execCommand("hiliteColor", false, color); } catch { /* ignore */ }
      // garante que o modo CSS nunca fique ligado (quebrava os outros comandos)
      try { document.execCommand("styleWithCSS", false, "false"); } catch { /* ignore */ }
      updateStates();
      sync();
    },
    [restoreAndFocus, sync, updateStates]
  );

  const insertLink = useCallback(() => {
    const url = window.prompt("URL do link:", "https://");
    if (url && url.trim()) exec("createLink", url.trim());
  }, [exec]);

  /* ---- notes CRUD ---- */
  const addNote = useCallback(() => {
    const n = newNote(`nota ${String(notesRef.current.length + 1).padStart(2, "0")}`);
    onChangeRef.current([...notesRef.current, n], n.id);
  }, []);

  const removeNote = useCallback((id: string) => {
    const arr = notesRef.current;
    if (arr.length <= 1) return;
    const note = arr.find((n) => n.id === id);
    if (note && note.content.replace(/<[^>]*>/g, "").trim().length > 12) {
      if (!window.confirm(`apagar a nota "${note.title}"?`)) return;
    }
    const idx = arr.findIndex((n) => n.id === id);
    const next = arr.filter((n) => n.id !== id);
    const nextActive =
      id === activeIdRef.current ? next[Math.max(0, idx - 1)].id : activeIdRef.current;
    onChangeRef.current(next, nextActive);
  }, []);

  const commitRename = useCallback(() => {
    const id = renamingId;
    setRenamingId(null);
    const v = renameVal.trim();
    if (!id || !v) return;
    onChangeRef.current(notesRef.current.map((n) => (n.id === id ? { ...n, title: v } : n)));
  }, [renamingId, renameVal]);

  const reorder = useCallback((from: number, to: number) => {
    const arr = [...notesRef.current];
    if (from === to || from < 0 || from >= arr.length) return;
    const [it] = arr.splice(from, 1);
    arr.splice(Math.min(to, arr.length), 0, it);
    onChangeRef.current(arr);
  }, []);

  const setSb = (v: boolean) => {
    setSbOpen(v);
    lsSet("ordo:ui:notes-sb", v ? "1" : "0");
  };
  const setTb = (v: boolean) => {
    setTbOpen(v);
    lsSet("ordo:ui:notes-tb", v ? "1" : "0");
  };

  const activeIdx = notes.findIndex((n) => n.id === activeId);

  return (
    <PanelChrome
      index="01"
      title="notas"
      icon={NotebookPen}
      className="col-span-6 row-span-1 lg:col-span-3"
      actions={
        <>
          <HeaderIconBtn title={sbOpen ? "recolher barra lateral" : "abrir barra lateral"} onClick={() => setSb(!sbOpen)}>
            {sbOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
          </HeaderIconBtn>
          <HeaderIconBtn title={tbOpen ? "recolher formatação" : "mostrar formatação"} onClick={() => setTb(!tbOpen)} accent={tbOpen}>
            <Type size={13} />
          </HeaderIconBtn>
        </>
      }
    >
      {/* sidebar */}
      <aside
        className={`shrink-0 overflow-hidden border-carbon-700/70 bg-carbon-850/50 transition-[width,border] duration-300 ease-out ${
          sbOpen ? "w-52 border-r" : "w-0 border-r-0"
        }`}
      >
        <div className="flex h-full w-52 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-carbon-700/60 px-3">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-carbon-400">
              notas · {notes.length}
            </span>
            <button
              onClick={addNote}
              title="nova nota"
              className="ml-auto flex h-5.5 w-5.5 items-center justify-center rounded-md border border-carbon-600 text-carbon-300 transition-all hover:border-acid-500/60 hover:text-acid-300 active:scale-90"
            >
              <Plus size={12} strokeWidth={2.4} />
            </button>
          </div>
          <div className="os-scroll min-h-0 flex-1 overflow-y-auto p-1.5" onDragOver={(e) => e.preventDefault()}>
            {notes.map((n, i) => (
              <div
                key={n.id}
                draggable={renamingId !== n.id}
                onDragStart={(e) => {
                  dragIdx.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverIdx(i);
                }}
                onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx.current !== null) reorder(dragIdx.current, i);
                  dragIdx.current = null;
                  setOverIdx(null);
                }}
                onDragEnd={() => {
                  dragIdx.current = null;
                  setOverIdx(null);
                }}
                onClick={() => activeId !== n.id && onChange(notesRef.current, n.id)}
                className={`group relative mb-0.5 flex cursor-pointer items-center gap-1 rounded-lg border border-transparent px-1.5 py-[7px] transition-colors ${
                  n.id === activeId
                    ? "border-carbon-600 bg-carbon-750"
                    : "hover:bg-carbon-800/70"
                } ${overIdx === i ? "before:absolute before:-top-[2.5px] before:left-1 before:right-1 before:h-[2px] before:rounded before:bg-acid-400" : ""}`}
              >
                <span className={`absolute -ml-0.5 h-4 w-[2.5px] rounded-full bg-acid-400 transition-opacity ${n.id === activeId ? "opacity-100" : "opacity-0"}`} />
                <GripVertical
                  size={12}
                  className={`shrink-0 cursor-grab text-carbon-500 transition-opacity active:cursor-grabbing ${n.id === activeId ? "opacity-60" : "opacity-0 group-hover:opacity-60"}`}
                />
                {renamingId === n.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 rounded border border-acid-500/50 bg-carbon-900 px-1.5 py-0.5 text-[12px] text-white outline-none"
                  />
                ) : (
                  <span
                    className={`min-w-0 flex-1 truncate pl-0.5 text-[12.5px] ${n.id === activeId ? "font-medium text-white" : "text-carbon-300"}`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(n.id);
                      setRenameVal(n.title);
                    }}
                  >
                    {n.title}
                  </span>
                )}
                {renamingId !== n.id && (
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      title="renomear"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(n.id);
                        setRenameVal(n.title);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-carbon-400 hover:bg-carbon-600 hover:text-white"
                    >
                      <Pencil size={10.5} />
                    </button>
                    {notes.length > 1 && (
                      <button
                        title="apagar"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNote(n.id);
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded text-carbon-400 hover:bg-ember-400/20 hover:text-ember-400"
                      >
                        <Trash2 size={10.5} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* editor column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className={`grid shrink-0 transition-all duration-300 ease-out ${tbOpen ? "grid-rows-[1fr] border-b border-carbon-700/70" : "grid-rows-[0fr]"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 p-1.5">
              <TB label="desfazer" onClick={() => exec("undo")}><Undo2 size={13.5} /></TB>
              <TB label="refazer" onClick={() => exec("redo")}><Redo2 size={13.5} /></TB>
              <Divider />

              <select
                className={`${selCls} w-[104px]`}
                value={blockVal}
                title="estilo do parágrafo"
                onMouseDown={saveRange}
                onChange={(e) => exec("formatBlock", e.target.value)}
              >
                {BLOCKS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>

              <select
                className={`${selCls} w-[112px]`}
                value={FONTS.find((f) => fontVal.replace(/"/g, "'").toLowerCase().includes(f.value.split(",")[0].replace(/'/g, "").toLowerCase()))?.value ?? ""}
                title="fonte"
                onMouseDown={saveRange}
                onChange={(e) => e.target.value && exec("fontName", e.target.value)}
              >
                <option value="" disabled>fonte</option>
                {FONTS.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>

              <Divider />

              <TB label="diminuir tamanho" onClick={() => applyFontSize(Math.max(6, (typeof sizeVal === "number" ? sizeVal : 15) - 1))}>
                <span className="text-[13px] font-bold leading-none">−</span>
              </TB>
              <input
                type="number"
                min={6}
                max={400}
                value={sizeVal}
                title="tamanho da fonte (px)"
                onMouseDown={saveRange}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSizeVal(Number.isNaN(v) ? "" : v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // sem isso o browser insere quebra de linha no editor
                    if (typeof sizeVal === "number") applyFontSize(sizeVal);
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    applyFontSize(Math.min(400, (typeof sizeVal === "number" ? sizeVal : 15) + 1));
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    applyFontSize(Math.max(6, (typeof sizeVal === "number" ? sizeVal : 15) - 1));
                  }
                }}
                onBlur={() => typeof sizeVal === "number" && applyFontSize(sizeVal)}
                className="nospin h-7 w-12 shrink-0 rounded-md border border-transparent bg-transparent text-center text-[11.5px] font-medium text-carbon-100 outline-none transition-colors hover:border-carbon-600 hover:bg-carbon-700/60 focus:border-acid-500/50 focus:bg-carbon-800"
              />
              <TB label="aumentar tamanho" onClick={() => applyFontSize(Math.min(400, (typeof sizeVal === "number" ? sizeVal : 15) + 1))}>
                <span className="text-[13px] font-bold leading-none">+</span>
              </TB>

              <Divider />

              <TB label="negrito" active={activeStates.bold} onClick={() => exec("bold")}><Bold size={13.5} /></TB>
              <TB label="itálico" active={activeStates.italic} onClick={() => exec("italic")}><Italic size={13.5} /></TB>
              <TB label="sublinhado" active={activeStates.underline} onClick={() => exec("underline")}><Underline size={13.5} /></TB>
              <TB label="tachado" active={activeStates.strikeThrough} onClick={() => exec("strikeThrough")}><Strikethrough size={13.5} /></TB>
              <TB label="subscrito" active={activeStates.subscript} onClick={() => exec("subscript")}><Subscript size={13.5} /></TB>
              <TB label="sobrescrito" active={activeStates.superscript} onClick={() => exec("superscript")}><Superscript size={13.5} /></TB>

              <Divider />

              <div title="cor do texto" className="relative flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md text-carbon-300 transition-colors hover:bg-carbon-700/60 hover:text-white">
                <Baseline size={13.5} className="pointer-events-none" />
                <span className="pointer-events-none mt-[1px] h-[2.5px] w-4 rounded-full bg-acid-400" id="font-color-bar" />
                <input type="color" defaultValue="#e6e8eb" className="swatch absolute inset-0" onMouseDown={saveRange} onChange={(e) => exec("foreColor", e.target.value)} />
              </div>
              <div title="cor de destaque" className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-carbon-300 transition-colors hover:bg-carbon-700/60 hover:text-white">
                <Highlighter size={13.5} className="pointer-events-none" />
                <input type="color" defaultValue="#d4f74c" className="swatch absolute inset-0" onMouseDown={saveRange} onChange={(e) => applyHighlight(e.target.value)} />
              </div>

              <Divider />

              <TB label="inserir link" onClick={insertLink}><Link2 size={13.5} /></TB>
              <TB label="remover link" onClick={() => exec("unlink")}><Unlink size={13.5} /></TB>

              <Divider />

              <TB label="alinhar à esquerda" active={!!activeStates.justifyLeft} onClick={() => exec("justifyLeft")}><AlignLeft size={13.5} /></TB>
              <TB label="centralizar" active={activeStates.justifyCenter} onClick={() => exec("justifyCenter")}><AlignCenter size={13.5} /></TB>
              <TB label="alinhar à direita" active={activeStates.justifyRight} onClick={() => exec("justifyRight")}><AlignRight size={13.5} /></TB>
              <TB label="justificar" active={activeStates.justifyFull} onClick={() => exec("justifyFull")}><AlignJustify size={13.5} /></TB>

              <Divider />

              <TB label="lista com marcadores" active={activeStates.insertUnorderedList} onClick={() => exec("insertUnorderedList")}><List size={13.5} /></TB>
              <TB label="lista numerada" active={activeStates.insertOrderedList} onClick={() => exec("insertOrderedList")}><ListOrdered size={13.5} /></TB>
              <TB label="diminuir recuo" onClick={() => exec("outdent")}><IndentDecrease size={13.5} /></TB>
              <TB label="aumentar recuo" onClick={() => exec("indent")}><IndentIncrease size={13.5} /></TB>

              <Divider />

              <TB label="linha horizontal" onClick={() => exec("insertHorizontalRule")}><Minus size={13.5} /></TB>
              <TB label="limpar formatação" onClick={() => exec("removeFormat")}><RemoveFormatting size={13.5} /></TB>
            </div>
          </div>
        </div>

        {/* editor */}
        <div
          ref={editorRef}
          className="ws-editor os-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4"
          contentEditable
          suppressContentEditableWarning
          dir="ltr"
          spellCheck={false}
          data-ph="escreva aqui as anotações da sessão..."
          onInput={sync}
          onBlur={saveRange}
        />

        {/* status */}
        <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-carbon-700/60 px-3">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-carbon-500">
            {activeIdx + 1}/{notes.length} · {notes[activeIdx]?.title ?? ""}
          </span>
          <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.18em] text-carbon-500">
            {words} {words === 1 ? "palavra" : "palavras"}
          </span>
        </footer>
      </div>
    </PanelChrome>
  );
}

export const NotesPanel = memo(
  NotesPanelInner,
  (p, n) => p.notes === n.notes && p.activeId === n.activeId
);
