export type CanvasItemType = "sticky" | "text" | "image" | "draw" | "arrow";

export interface CanvasItem {
  id: string;
  type: CanvasItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: string;
  src?: string; // dataURL (image)
  fontSize?: number;
  d?: string; // svg path (draw)
  vw?: number; // viewbox original (draw)
  vh?: number;
  strokeWidth?: number;
  from?: string; // id do item de origem (arrow)
  to?: string; // id do item de destino (arrow)
  label?: string; // rótulo no meio da seta
  // formatação de texto (sticky e text)
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  font?: string;
  textColor?: string;
}

export interface OrdoNote {
  id: string;
  title: string;
  content: string; // html
  mode?: "doc" | "canvas";
  canvas?: CanvasItem[];
  view?: { x: number; y: number; z: number };
}

export interface OrdoMedia {
  id: string;
  name: string;
  data: string; // dataURL (vazio quando for youtube)
  lastPage?: number; // pdfs only
  source?: "file" | "youtube";
  videoId?: string; // youtube
}

export interface OrdoDoc {
  name: string;
  notes: OrdoNote[];
  activeNoteId: string;
  audios: OrdoMedia[];
  pdfs: OrdoMedia[];
  activePdfId: string | null;
  videos: OrdoMedia[];
  owlbearOpened: boolean;
}

export interface OrdoFilePayload extends OrdoDoc {
  app: "ordo";
  version: 1;
  savedAt: string;
}
