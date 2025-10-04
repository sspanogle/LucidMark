export type ThemePreference = 'light' | 'dark' | 'system';

export interface EditorPreferences {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly showLineNumbers: boolean;
  readonly softWrap: boolean;
}

export interface PreviewPreferences {
  readonly enableMath: boolean;
  readonly enableDiagrams: boolean;
  readonly enableSyntaxHighlighting: boolean;
}

export interface AutoSavePreferences {
  readonly enabled: boolean;
  readonly intervalMs: number;
}

export interface Preferences {
  readonly theme: ThemePreference;
  readonly editor: EditorPreferences;
  readonly preview: PreviewPreferences;
  readonly autoSave: AutoSavePreferences;
}

export interface PreferencesUpdate {
  readonly theme?: ThemePreference;
  readonly editor?: Partial<EditorPreferences>;
  readonly preview?: Partial<PreviewPreferences>;
  readonly autoSave?: Partial<AutoSavePreferences>;
}
