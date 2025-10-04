import { invoke } from '@tauri-apps/api/core';
import type {
  DocumentSession,
  SessionState,
  SessionUpdate,
  WindowState,
} from '@shared-types/session';

const COMMANDS = {
  get: 'get_session_state',
  save: 'save_session_state',
} as const;

type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

const DEFAULT_SESSION: SessionState = {
  lastOpenedFile: null,
  window: null,
  activeDocument: null,
  documents: [],
};

let cachedSession: SessionState | null = null;

function cloneSession(session: SessionState): SessionState {
  return JSON.parse(JSON.stringify(session)) as SessionState;
}

function defaultWindowState(): WindowState {
  return {
    width: 0,
    height: 0,
    x: null,
    y: null,
    maximized: false,
    fullscreen: false,
  };
}

function cloneDocument(document: DocumentSession): DocumentSession {
  return JSON.parse(JSON.stringify(document)) as DocumentSession;
}

function applyUpdateToSession(
  base: SessionState,
  update: SessionUpdate,
): SessionState {
  const baseWindow = base.window ?? null;
  const lastOpenedFile =
    update.lastOpenedFile !== undefined ? update.lastOpenedFile : base.lastOpenedFile;
  const activeDocument =
    update.activeDocument !== undefined ? update.activeDocument : base.activeDocument;

  let documents: DocumentSession[];
  if (update.clearDocuments) {
    documents = [];
  } else if (update.documents) {
    documents = update.documents.map(cloneDocument);
  } else {
    documents = base.documents.map(cloneDocument);
  }

  let windowState = baseWindow ? { ...baseWindow } : null;

  if (update.clearWindow) {
    windowState = null;
  } else if (update.window) {
    const previous = windowState ?? { ...defaultWindowState() };
    windowState = {
      width: update.window.width ?? previous.width,
      height: update.window.height ?? previous.height,
      x: update.window.x !== undefined ? update.window.x : previous.x,
      y: update.window.y !== undefined ? update.window.y : previous.y,
      maximized: update.window.maximized ?? previous.maximized,
      fullscreen: update.window.fullscreen ?? previous.fullscreen,
    };
  }

  return {
    lastOpenedFile,
    window: windowState,
    activeDocument,
    documents,
  };
}

async function call<T>(command: CommandName, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

export async function loadSessionState(): Promise<SessionState> {
  if (cachedSession) {
    return cachedSession;
  }

  try {
    const response = await call<SessionState>(COMMANDS.get);
    cachedSession = cloneSession(response);
  } catch (error) {
    console.error('Failed to load session state from backend', error);
    cachedSession = cloneSession(DEFAULT_SESSION);
  }

  return cachedSession;
}

export async function updateSessionState(update: SessionUpdate): Promise<SessionState> {
  try {
    const response = await call<SessionState>(COMMANDS.save, { update });
    cachedSession = cloneSession(response);
  } catch (error) {
    console.error('Failed to persist session state update', error);
    const fallback = cachedSession ?? cloneSession(DEFAULT_SESSION);
    cachedSession = applyUpdateToSession(fallback, update);
  }

  return cachedSession;
}

export function clearSessionCache(): void {
  cachedSession = null;
}

export function getDefaultSessionState(): SessionState {
  return cloneSession(DEFAULT_SESSION);
}
