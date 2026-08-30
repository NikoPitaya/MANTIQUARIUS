export interface OrdoNote {
  id: string;
  title: string;
  content: string; // html
}

export interface OrdoMedia {
  id: string;
  name: string;
  data: string; // dataURL
  lastPage?: number; // pdfs only
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
