import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Music, Plus, Pencil, Trash2, Upload, Repeat } from "lucide-react";
import type { OrdoMedia } from "../types";
import { fileToDataURL, dataURLToObjectURL, stripExt, uid } from "../lib/ordo";
import { PanelChrome, HeaderIconBtn } from "./PanelChrome";
import { ContextMenuView, useContextMenu } from "./ContextMenu";
import { VolumeSlider } from "./VolumeSlider";
import { lsGet, lsSet } from "../lib/store";

interface Props {
  audios: OrdoMedia[];
  onChange: (audios: OrdoMedia[]) => void;
}

const readVol = (key: string): number => {
  const raw = Number(lsGet(key));
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 1;
};

function AudioPanelInner({ audios, onChange }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volume, setVolume] = useState(() => readVol("ordo:vol:audio"));
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [busy, setBusy] = useState(false);
  const els = useRef(new Map<string, HTMLAudioElement>());
  const inputRef = useRef<HTMLInputElement>(null);
  const { menu, open, close } = useContextMenu();

  const audiosRef = useRef(audios);
  useEffect(() => { audiosRef.current = audios; });
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; });

  const getEl = useCallback((m: OrdoMedia): HTMLAudioElement => {
    const cached = els.current.get(m.id);
    if (cached) return cached;
    const a = new Audio(dataURLToObjectURL(m.data));
    a.loop = true;
    a.preload = "auto";
    a.volume = volumeRef.current;
    els.current.set(m.id, a);
    return a;
  }, []);

  /* aplica o volume em todas as faixas já carregadas */
  useEffect(() => {
    els.current.forEach((a) => {
      a.volume = volume;
    });
    lsSet("ordo:vol:audio", String(volume));
  }, [volume]);

  const stop = useCallback((id: string) => {
    const a = els.current.get(id);
    if (a) {
      a.pause();
      a.currentTime = 0; // reinicia do zero ao parar
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      if (playingId === id) {
        stop(id);
        setPlayingId(null);
        return;
      }
      if (playingId) stop(playingId);
      const m = audiosRef.current.find((x) => x.id === id);
      if (!m) return;
      const a = getEl(m);
      a.currentTime = 0;
      a.play().catch(() => setPlayingId(null));
      setPlayingId(id);
    },
    [playingId, getEl, stop]
  );

  useEffect(
    () => () => {
      els.current.forEach((a) => {
        a.pause();
        URL.revokeObjectURL(a.src);
      });
      els.current.clear();
    },
    []
  );

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm|wma)$/i.test(f.name));
    if (list.length === 0) return;
    setBusy(true);
    try {
      const items: OrdoMedia[] = [];
      for (const f of list) {
        items.push({ id: uid(), name: stripExt(f.name), data: await fileToDataURL(f) });
      }
      onChangeRef.current([...audiosRef.current, ...items]);
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      if (playingId === id) setPlayingId(null);
      stop(id);
      const a = els.current.get(id);
      if (a) URL.revokeObjectURL(a.src);
      els.current.delete(id);
      onChangeRef.current(audiosRef.current.filter((x) => x.id !== id));
    },
    [playingId, stop]
  );

  const commitRename = useCallback(() => {
    const id = renamingId;
    setRenamingId(null);
    const v = renameVal.trim();
    if (!id || !v) return;
    onChangeRef.current(audiosRef.current.map((x) => (x.id === id ? { ...x, name: v } : x)));
    const a = els.current.get(id);
    if (a) a.dataset.name = v;
  }, [renamingId, renameVal]);

  return (
    <PanelChrome
      index="03"
      title="áudio"
      icon={Music}
      className="col-span-6 row-span-1 lg:col-span-2"
      actions={
        <HeaderIconBtn title="adicionar áudio" onClick={() => inputRef.current?.click()} accent>
          <Plus size={13} strokeWidth={2.4} />
        </HeaderIconBtn>
      }
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
      >
        {audios.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-5">
            <button
              onClick={() => inputRef.current?.click()}
              className="group flex w-full flex-col items-center gap-3.5 rounded-2xl border border-dashed border-carbon-500 px-6 py-9 transition-all hover:border-acid-500/60 hover:bg-carbon-850 active:scale-[0.98]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-carbon-600 bg-carbon-800 text-carbon-200 transition-colors group-hover:border-acid-500/50 group-hover:text-acid-300">
                <Upload size={20} strokeWidth={1.7} />
              </span>
              <span className="text-center">
                <span className="block font-display text-sm font-semibold text-white">adicionar áudio</span>
                <span className="mt-1 block font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.16em] text-carbon-400">
                  qualquer formato · toca em loop
                  <br />
                  botão direito para renomear
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="os-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {audios.map((m) => {
              const active = playingId === m.id;
              return (
                <div
                  key={m.id}
                  onContextMenu={(e) =>
                    open(e, [
                      {
                        label: "renomear",
                        icon: Pencil,
                        onClick: () => {
                          setRenamingId(m.id);
                          setRenameVal(m.name);
                        },
                      },
                      { label: "remover", icon: Trash2, danger: true, onClick: () => remove(m.id) },
                    ])
                  }
                  className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
                    active
                      ? "border-acid-500/50 bg-acid-400/[0.08]"
                      : "border-carbon-700 bg-carbon-850/60 hover:border-carbon-500 hover:bg-carbon-800"
                  }`}
                >
                  <button
                    onClick={() => toggle(m.id)}
                    title={active ? "parar (reinicia do zero)" : "tocar em loop"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all active:scale-90 ${
                      active
                        ? "bg-acid-400 text-carbon-950 shadow-[0_0_16px_rgba(212,247,76,0.35)]"
                        : "border border-carbon-600 text-carbon-300 group-hover:border-acid-500/40 group-hover:text-acid-300"
                    }`}
                  >
                    {active ? (
                      <span className="eq text-carbon-950"><i /><i /><i /><i /></span>
                    ) : (
                      <Music size={13.5} />
                    )}
                  </button>

                  {renamingId === m.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-md border border-acid-500/50 bg-carbon-900 px-2 py-1 text-[12.5px] text-white outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => toggle(m.id)}
                      className="min-w-0 flex-1 text-left"
                      title={m.name}
                    >
                      <span className={`block truncate text-[12.5px] font-medium ${active ? "text-white" : "text-carbon-200"}`}>
                        {m.name}
                      </span>
                      {active && (
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.2em] text-acid-400">
                          <Repeat size={9} /> loop ativo
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {audios.length > 0 && (
          <>
            <div className="shrink-0 border-t border-carbon-700/60 px-3 py-1.5">
              <VolumeSlider value={volume} onChange={setVolume} title="volume das músicas" />
            </div>
            <footer className="flex h-6 shrink-0 items-center border-t border-carbon-700/60 px-3">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-carbon-500">
                {audios.length} {audios.length === 1 ? "faixa" : "faixas"}{busy ? " · carregando" : ""}
              </span>
              <span className={`ml-auto font-mono text-[9.5px] uppercase tracking-[0.18em] ${playingId ? "text-acid-400" : "text-carbon-500"}`}>
                {playingId ? "tocando" : "parado"}
              </span>
            </footer>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <ContextMenuView menu={menu} onClose={close} />
    </PanelChrome>
  );
}

export const AudioPanel = memo(AudioPanelInner, (p, n) => p.audios === n.audios);
