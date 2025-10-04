export interface WindowState {
  readonly width: number;
  readonly height: number;
  readonly x: number | null;
  readonly y: number | null;
  readonly maximized: boolean;
  readonly fullscreen: boolean;
}

export interface CursorPosition {
  readonly line: number;
  readonly column: number;
}

export interface DocumentSession {
  readonly path: string | null;
  readonly content: string;
  readonly cursor: CursorPosition | null;
  readonly dirty: boolean;
  readonly temporaryId: string | null;
}

export interface SessionState {
  readonly lastOpenedFile: string | null;
  readonly window: WindowState | null;
  readonly activeDocument: string | null;
  readonly documents: DocumentSession[];
}

export interface WindowStateUpdate {
  readonly width?: number;
  readonly height?: number;
  readonly x?: number | null;
  readonly y?: number | null;
  readonly maximized?: boolean;
  readonly fullscreen?: boolean;
}

export interface SessionUpdate {
  readonly lastOpenedFile?: string | null;
  readonly window?: WindowStateUpdate;
  readonly clearWindow?: boolean;
  readonly activeDocument?: string | null;
  readonly documents?: DocumentSession[];
  readonly clearDocuments?: boolean;
}
