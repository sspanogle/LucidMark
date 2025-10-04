import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPreferencesCache,
  getDefaultPreferences,
  loadPreferences,
  updatePreferences,
} from '@settings/preferences-store';

type InvokeHandler = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const invokeMock = vi.fn<InvokeHandler>();

vi.mock('@tauri-apps/api/core', (): { invoke: InvokeHandler } => ({
  invoke: (command: string, args?: Record<string, unknown>) => invokeMock(command, args),
}));

describe('preferences-store', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    clearPreferencesCache();
  });

  it('loads preferences from backend and reuses cache', async () => {
    const backendPreferences = {
      ...getDefaultPreferences(),
      theme: 'dark',
    };

    invokeMock.mockResolvedValueOnce(backendPreferences);

    const prefs = await loadPreferences();

    expect(prefs).toEqual(backendPreferences);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenLastCalledWith('get_preferences', undefined);

    invokeMock.mockClear();

    const cached = await loadPreferences();
    expect(cached).toEqual(backendPreferences);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('persists updates via backend and keeps cache in sync', async () => {
    const initial = getDefaultPreferences();
    const updated = {
      ...initial,
      theme: 'dark',
      editor: { ...initial.editor, fontSize: 16 },
    };

    invokeMock.mockResolvedValueOnce(initial);
    await loadPreferences();

    invokeMock.mockResolvedValueOnce(updated);
    const result = await updatePreferences({ theme: 'dark', editor: { fontSize: 16 } });

    expect(result).toEqual(updated);
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'save_preferences', {
      update: { theme: 'dark', editor: { fontSize: 16 } },
    });

    invokeMock.mockClear();
    const cached = await loadPreferences();
    expect(cached).toEqual(updated);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('falls back to defaults when backend load fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('offline'));

    const prefs = await loadPreferences();
    expect(prefs).toEqual(getDefaultPreferences());
  });
});
