import { invoke } from '@tauri-apps/api/core';
import type { Preferences, PreferencesUpdate } from '@shared-types/settings';

const COMMANDS = {
  get: 'get_preferences',
  save: 'save_preferences',
} as const;

type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

let cachedPreferences: Preferences | null = null;

const BASE_PREFERENCES: Preferences = {
  theme: 'system',
  editor: {
    fontFamily: 'system-ui',
    fontSize: 14,
    showLineNumbers: true,
    softWrap: true,
  },
  preview: {
    enableMath: true,
    enableDiagrams: true,
    enableSyntaxHighlighting: true,
  },
  autoSave: {
    enabled: true,
    intervalMs: 2000,
  },
};

function clonePreferences(preferences: Preferences): Preferences {
  return JSON.parse(JSON.stringify(preferences)) as Preferences;
}

async function request<T>(command: CommandName, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

export async function loadPreferences(): Promise<Preferences> {
  if (cachedPreferences) {
    return cachedPreferences;
  }

  try {
    const response = await request<Preferences>(COMMANDS.get);
    cachedPreferences = response;
  } catch (error) {
    console.error('Failed to load preferences from backend', error);
    cachedPreferences = clonePreferences(BASE_PREFERENCES);
  }

  return cachedPreferences;
}

export async function updatePreferences(update: PreferencesUpdate): Promise<Preferences> {
  try {
    const response = await request<Preferences>(COMMANDS.save, { update });
    cachedPreferences = response;
  } catch (error) {
    console.error('Failed to persist preferences update', error);
    cachedPreferences = cachedPreferences ?? clonePreferences(BASE_PREFERENCES);
  }

  return cachedPreferences;
}

export function clearPreferencesCache(): void {
  cachedPreferences = null;
}

export function getDefaultPreferences(): Preferences {
  return clonePreferences(BASE_PREFERENCES);
}
