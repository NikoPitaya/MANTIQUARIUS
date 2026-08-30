import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Dices, ScreenShare, RefreshCw, Square, TriangleAlert, Focus, MonitorUp,
} from "lucide-react";
import { PanelChrome, HeaderIconBtn } from "./PanelChrome";

interface Props {
  opened: boolean;
  onChange: (opened: boolean) => void;
}

function OwlbearPanelInner({ opened, onChange }: Props) {
  const owlWin = useRef<Window | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* poll owlbear window state */
  useEffect(() => {
    const t = setInterval(() => {
      setWinOpen(!!(owlWin.current && !owlWin.current.closed));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const openOwlbear = useCallback(() => {
    setError(null);
    const w = window.open(
      "https://www.owlbear.rodeo/",
      "ordo-owlbear",
      "popup,width=1440,height=900"
    );
    if (!w) {
      setError("o navegador bloqueou o pop-up — permita pop-ups para este site e tente de novo.");
      return;
    }
    owlWin.current = w;
    setWinOpen(true);
    if (!opened) onChange(true);
  }, [opened, onChange]);

  const focusOwlbear = useCallback(() => {
    if (owlWin.current && !owlWin.current.closed) {
      owlWin.current.focus();
    } else {
      openOwlbear();
    }
  }, [openOwlbear]);

  const stopMirror = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }, []);

  const startMirror = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("seu navegador não permite espelhar abas aqui (precisa de https).");
      return;
    }
    setBusy(true);
    try {
      stopMirror();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track?.addEventListener("ended", stopMirror);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStreaming(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError("captura cancelada — escolha a janela do owlbear para espelhar.");
      } else {
        setError("não foi possível espelhar a aba neste navegador.");
      }
    } finally {
      setBusy(false);
    }
  }, [stopMirror]);

  useEffect(() => stopMirror, [stopMirror]);

  return (
    <PanelChrome
      index="02"
      title="owlbear rodeo"
      icon={Dices}
      className="col-span-6 row-span-1 lg:col-span-3"
      actions={
        opened ? (
          <>
            {streaming && (
              <>
                <HeaderIconBtn title="trocar aba espelhada" onClick={() => void startMirror()}>
                  <RefreshCw size={12} />
                </HeaderIconBtn>
                <HeaderIconBtn title="parar espelhamento" onClick={stopMirror}>
                  <Square size={11} />
                </HeaderIconBtn>
              </>
            )}
            <HeaderIconBtn title="focar janela do owlbear" onClick={focusOwlbear} accent={winOpen}>
              <Focus size={12.5} />
            </HeaderIconBtn>
          </>
        ) : undefined
      }
    >
      {!opened ? (
        /* ---------- idle: apenas o botão de abrir ---------- */
        <div className="ws-backdrop flex flex-1 flex-col items-center justify-center gap-5 p-6">
          <button
            onClick={openOwlbear}
            className="group flex flex-col items-center gap-4 rounded-2xl border border-carbon-600 bg-carbon-850/80 px-10 py-8 transition-all hover:border-acid-500/60 hover:bg-carbon-800 active:scale-[0.98]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-acid-400 text-carbon-950 shadow-[0_0_36px_rgba(212,247,76,0.3)] transition-transform group-hover:scale-105 group-hover:rotate-3">
              <Dices size={26} strokeWidth={1.8} />
            </span>
            <span className="text-center">
              <span className="block font-display text-base font-semibold text-white">
                abrir owlbear rodeo
              </span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-carbon-400">
                abre em janela separada
              </span>
            </span>
          </button>
          {error && <ErrText msg={error} />}
        </div>
      ) : (
        /* ---------- mirror stage ---------- */
        <div className="relative flex-1 bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            onClick={focusOwlbear}
            title={streaming ? "clique para focar a janela do owlbear" : undefined}
            className={`absolute inset-0 h-full w-full object-contain ${streaming ? "cursor-pointer" : "hidden"}`}
          />

          {streaming && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-ember-400/40 bg-carbon-950/80 px-2.5 py-1 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-400 animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-ember-400">
                ao vivo
              </span>
            </div>
          )}
          {streaming && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity duration-200 hover:opacity-100">
              <span className="rounded-full bg-carbon-950/80 px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-carbon-200 backdrop-blur">
                clique para focar o owlbear
              </span>
            </div>
          )}

          {!streaming && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
              <button
                onClick={() => void startMirror()}
                disabled={busy}
                className="group flex flex-col items-center gap-4 rounded-2xl border border-dashed border-carbon-500 bg-carbon-900/60 px-10 py-8 transition-all hover:border-acid-500/60 hover:bg-carbon-850 active:scale-[0.98] disabled:opacity-60"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-carbon-600 bg-carbon-800 text-carbon-200 transition-colors group-hover:border-acid-500/50 group-hover:text-acid-300">
                  <ScreenShare size={24} strokeWidth={1.6} />
                </span>
                <span className="text-center">
                  <span className="block font-display text-base font-semibold text-white">
                    {busy ? "aguardando escolha..." : "selecionar aba"}
                  </span>
                  <span className="mt-1 block max-w-[260px] font-mono text-[10px] leading-relaxed uppercase tracking-[0.14em] text-carbon-400">
                    escolha a janela do owlbear para espelhá-la aqui em tempo real
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${winOpen ? "bg-acid-400" : "bg-carbon-500"}`}
                />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-carbon-400">
                  {winOpen ? "owlbear aberto" : "janela fechada"}
                </span>
                <button
                  onClick={focusOwlbear}
                  className="ml-1 flex items-center gap-1.5 rounded-lg border border-carbon-600 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-carbon-200 transition-colors hover:border-acid-500/50 hover:text-acid-300"
                >
                  <MonitorUp size={11} />
                  {winOpen ? "focar" : "reabrir"}
                </button>
              </div>

              {error && <ErrText msg={error} />}
            </div>
          )}
        </div>
      )}
    </PanelChrome>
  );
}

function ErrText({ msg }: { msg: string }) {
  return (
    <p className="anim-pop-in flex max-w-[300px] items-start gap-2 rounded-lg border border-ember-400/40 bg-ember-400/10 px-3 py-2 text-[11.5px] leading-snug text-ember-400">
      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
      {msg}
    </p>
  );
}

export const OwlbearPanel = memo(OwlbearPanelInner, (p, n) => p.opened === n.opened);
