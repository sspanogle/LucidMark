import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionCache,
  getDefaultSessionState,
  loadSessionState,
  updateSessionState,
} from '@app/session-store';

type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const invokeMock = vi.fn<InvokeFn>();

vi.mock('@tauri-apps/api/core', (): { invoke: InvokeFn } => ({
  invoke: (command: string, args?: Record<string, unknown>) => invokeMock(command, args),
}));

describe('session-store', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    clearSessionCache();
  });

  it('loads session state from backend and caches result', async () => {
    const backendState = {
      ...getDefaultSessionState(),
      lastOpenedFile: '/docs/readme.md',
      activeDocument: '/docs/readme.md',
      documents: [
        {
          path: '/docs/readme.md',
          content: '# Notes',
          cursor: { line: 1, column: 5 },
          dirty: false,
          temporaryId: null,
        },
      ],
    };

    invokeMock.mockResolvedValueOnce(backendState);

    const loaded = await loadSessionState();
    expect(loaded).toEqual(backendState);
    expect(invokeMock).toHaveBeenCalledWith('get_session_state', undefined);

    invokeMock.mockClear();

    const cached = await loadSessionState();
    expect(cached).toEqual(backendState);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('updates session state and maintains cache', async () => {
    const initial = getDefaultSessionState();
    const updated = {
      ...initial,
      lastOpenedFile: '/notes/todo.md',
      activeDocument: '/notes/todo.md',
      documents: [
        {
          path: '/notes/todo.md',
          content: '- [ ] Persist state',
          cursor: { line: 2, column: 3 },
          dirty: true,
          temporaryId: null,
        },
      ],
      window: {
        width: 1200,
        height: 900,
        x: 10,
        y: 10,
        maximized: true,
        fullscreen: false,
      },
    };

    invokeMock.mockResolvedValueOnce(initial);
    await loadSessionState();

    invokeMock.mockResolvedValueOnce(updated);
    const result = await updateSessionState({
      lastOpenedFile: '/notes/todo.md',
      activeDocument: '/notes/todo.md',
      documents: [
        {
          path: '/notes/todo.md',
          content: '- [ ] Persist state',
          cursor: { line: 2, column: 3 },
          dirty: true,
          temporaryId: null,
        },
      ],
      window: {
        width: 1200,
        height: 900,
        x: 10,
        y: 10,
        maximized: true,
      },
    });

    expect(result).toEqual(updated);
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'save_session_state', {
      update: {
        lastOpenedFile: '/notes/todo.md',
        activeDocument: '/notes/todo.md',
        documents: [
          {
            path: '/notes/todo.md',
            content: '- [ ] Persist state',
            cursor: { line: 2, column: 3 },
            dirty: true,
            temporaryId: null,
          },
        ],
        window: {
          width: 1200,
          height: 900,
          x: 10,
          y: 10,
          maximized: true,
        },
      },
    });

    invokeMock.mockClear();
    const cached = await loadSessionState();
    expect(cached).toEqual(updated);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('falls back to defaults when backend load fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('offline'));

    const state = await loadSessionState();
    expect(state).toEqual(getDefaultSessionState());
  });

  it('applies updates locally when backend persistence fails', async () => {
    const initial = getDefaultSessionState();

    invokeMock.mockResolvedValueOnce(initial);
    await loadSessionState();

    invokeMock.mockRejectedValueOnce(new Error('offline'));
    const result = await updateSessionState({
      lastOpenedFile: '/drafts/new.md',
      activeDocument: '/drafts/new.md',
      documents: [
        {
          path: '/drafts/new.md',
          content: 'Scratchpad',
          cursor: { line: 0, column: 0 },
          dirty: true,
          temporaryId: 'temp-1',
        },
      ],
      window: {
        width: 1440,
        height: 900,
      },
    });

    expect(result.lastOpenedFile).toBe('/drafts/new.md');
    expect(result.window?.width).toBe(1440);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].path).toBe('/drafts/new.md');
  });

  it('clears window layout when requested', async () => {
    const initial = {
      lastOpenedFile: '/drafts.md',
      activeDocument: '/drafts.md',
      documents: [
        {
          path: '/drafts.md',
          content: 'Hello world',
          cursor: { line: 0, column: 5 },
          dirty: false,
          temporaryId: null,
        },
      ],
      window: {
        width: 1024,
        height: 768,
        x: 100,
        y: 100,
        maximized: false,
        fullscreen: false,
      },
    };

    invokeMock.mockResolvedValueOnce(initial);
    await loadSessionState();

    invokeMock.mockResolvedValueOnce({ ...initial, window: null });

    const result = await updateSessionState({ clearWindow: true });
    expect(result.window).toBeNull();
  });
});
