import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { DragDropEvent } from '@tauri-apps/api/webview';

import { MarkdownEditor } from '@editor/markdown-editor';
import {
  listRecentFiles,
  pickFile,
  readFileContent,
  registerRecentFile,
  saveFileAs,
  writeFileContent,
} from '@file-system/file-system-service';
import { enhanceMarkdown } from '@renderer/enhance-markdown';
import { MarkdownRenderer } from '@renderer/markdown-renderer';
import type { FileMetadata } from '@shared-types/files';
import { getDefaultPreferences, loadPreferences, updatePreferences } from '@settings/preferences-store';
import type { Preferences } from '@shared-types/settings';

interface ViewerState {
  path: string | null;
  displayPath: string | null;
  size: number;
  lastModified: string | null;
  content: string;
}

interface SessionState {
  isEditing: boolean;
  isDirty: boolean;
  originalContent: string;
}

interface TabState {
  id: string;
  viewerState: ViewerState;
  sessionState: SessionState;
  editorContent: string | null;
}

const renderer = new MarkdownRenderer();
const MENU_OPEN_EVENT = 'menu://open-markdown';
const MENU_OPEN_RECENT_EVENT = 'menu://open-recent';

export function bootstrapApp(): void {
  const root = document.querySelector('#app');
  const layout = root?.querySelector<HTMLElement>('.app-layout');
  const viewer = document.getElementById('markdown-viewer');
  const statusLine = root?.querySelector<HTMLElement>('[data-status]');
  const filePath = root?.querySelector<HTMLElement>('[data-file-path]');
  const fileSize = root?.querySelector<HTMLElement>('[data-file-size]');
  const fileUpdated = root?.querySelector<HTMLElement>('[data-file-updated]');
  const openTriggers = Array.from(root?.querySelectorAll<HTMLElement>('[data-open-trigger]') ?? []);
  const recentSection = root?.querySelector<HTMLElement>('[data-recent-section]');
  const recentList = root?.querySelector<HTMLUListElement>('[data-recent-list]');
  const mathToggle = root?.querySelector<HTMLInputElement>('[data-math-toggle]');
  const diagramsToggle = root?.querySelector<HTMLInputElement>('[data-diagrams-toggle]');
  const syntaxToggle = root?.querySelector<HTMLInputElement>('[data-syntax-toggle]');
  const resizeHandle = root?.querySelector<HTMLElement>('[data-resize-handle]');
  const editorPanel = root?.querySelector<HTMLElement>('[data-editor-panel]');
  const editorPane = root?.querySelector<HTMLElement>('[data-editor-pane]');
  const editorRoot = root?.querySelector<HTMLElement>('[data-editor-root]');
  const editorStatus = root?.querySelector<HTMLElement>('[data-editor-status]');
  const editToggle = root?.querySelector<HTMLButtonElement>('[data-edit-toggle]');
  const saveButton = root?.querySelector<HTMLButtonElement>('[data-save]');
  const revertButton = root?.querySelector<HTMLButtonElement>('[data-revert]');
  const copyButton = root?.querySelector<HTMLButtonElement>('[data-copy]');
  const activeDocDetails = root?.querySelector<HTMLDetailsElement>('[data-active-doc-details]');
  const recentDetails = root?.querySelector<HTMLDetailsElement>('[data-recent-details]');
  const newDocButton = root?.querySelector<HTMLButtonElement>('[data-new-doc]');
  const markdownTools = root?.querySelector<HTMLElement>('[data-markdown-tools]');
  const mdToolButtons = Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-md-tool]') ?? []);
  const navLinks = Array.from(root?.querySelectorAll<HTMLAnchorElement>('[data-nav-link]') ?? []);
  const settingsView = root?.querySelector<HTMLElement>('[data-settings-view]');
  const aboutView = root?.querySelector<HTMLElement>('[data-about-view]');
  const tabBar = root?.querySelector<HTMLElement>('[data-tab-bar]');
  const tabList = root?.querySelector<HTMLElement>('[data-tab-list]');
  const newTabButton = root?.querySelector<HTMLButtonElement>('[data-new-tab]');

  if (
    !root ||
    !layout ||
    !viewer ||
    !statusLine ||
    !filePath ||
    !fileSize ||
    !fileUpdated ||
    !recentSection ||
    !recentList ||
    !mathToggle ||
    !diagramsToggle ||
    !syntaxToggle ||
    !resizeHandle ||
    !editorPanel ||
    !editorPane ||
    !editorRoot ||
    !editorStatus ||
    !editToggle ||
    !saveButton ||
    !revertButton ||
    !copyButton ||
    !activeDocDetails ||
    !recentDetails ||
    !newDocButton ||
    !markdownTools ||
    !settingsView ||
    !aboutView ||
    !tabBar ||
    !tabList ||
    !newTabButton
  ) {
    console.error('Failed to bootstrap LucidMark viewer: missing required DOM nodes.');
    return;
  }

  const runningInTauri = isTauriRuntime();

  let preferences: Preferences = getDefaultPreferences();
  let preferencesOverride = false;

  const state: ViewerState = {
    path: null,
    displayPath: null,
    size: 0,
    lastModified: null,
    content: '',
  };

  const session: SessionState = {
    isEditing: false,
    isDirty: false,
    originalContent: '',
  };

  // Tab management
  const tabs: Map<string, TabState> = new Map();
  let activeTabId: string | null = null;
  let tabIdCounter = 0;

  const SIDEBAR_WIDTH_STORAGE_KEY = 'lucidmark.sidebarWidth';
  const ACTIVE_DOC_COLLAPSED_KEY = 'lucidmark.activeDocCollapsed';
  const RECENT_DOC_COLLAPSED_KEY = 'lucidmark.recentDocCollapsed';
  const SIDEBAR_MIN_WIDTH = 320;
  const VIEWER_MIN_WIDTH = 420;

  const encoder = new TextEncoder();
  let editor: MarkdownEditor | null = null;
  let livePreviewTimer: number | null = null;
  let teardownScrollSync: (() => void) | null = null;
  let requestPreviewAlignment: (() => void) | null = null;

  const WARNING_CONTAINER_CLASS = 'preview-warning';
  const WARNING_LIST_CLASS = 'preview-warning__list';
  const WARNING_ITEM_CLASS = 'preview-warning__item';

  const renderPreviewWarnings = (messages: string[]): void => {
    Array.from(viewer.querySelectorAll(`.${WARNING_CONTAINER_CLASS}`)).forEach((node) => {
      node.remove();
    });

    if (messages.length === 0) {
      return;
    }

    const warningBlock = document.createElement('div');
    warningBlock.className = WARNING_CONTAINER_CLASS;

    if (messages.length === 1) {
      warningBlock.textContent = messages[0];
    } else {
      const list = document.createElement('ul');
      list.className = WARNING_LIST_CLASS;
      messages.forEach((message) => {
        const item = document.createElement('li');
        item.className = WARNING_ITEM_CLASS;
        item.textContent = message;
        list.append(item);
      });
      warningBlock.append(list);
    }

    viewer.prepend(warningBlock);
  };

  const setStatus = (message: string, variant: 'default' | 'info' | 'error' = 'default'): void => {
    statusLine.textContent = message;
    statusLine.classList.remove('status-line--info', 'status-line--error');
    if (variant === 'info') {
      statusLine.classList.add('status-line--info');
    } else if (variant === 'error') {
      statusLine.classList.add('status-line--error');
    }
  };

  const updateMeta = (file: ViewerState): void => {
    filePath.textContent = file.displayPath ?? 'None selected';
    fileSize.textContent = file.size ? formatBytes(file.size) : '—';
    fileUpdated.textContent = session.isDirty ? 'Unsaved changes' : file.lastModified ?? '—';
  };

  const setEditorStatus = (message: string): void => {
    editorStatus.textContent = message;
  };

  const describeCurrentFile = (): string => {
    const target = state.displayPath ?? state.path;
    if (!target) {
      return 'Untitled document';
    }
    return truncatePath(target);
  };

  const readStoredSidebarWidth = (): number | null => {
    try {
      const value = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (!value) {
        return null;
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      console.warn('Unable to read stored sidebar width', error);
      return null;
    }
  };

  const storeSidebarWidth = (width: number): void => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, `${Math.round(width)}`);
    } catch (error) {
      console.warn('Unable to persist sidebar width', error);
    }
  };

  const applySidebarWidth = (width: number): void => {
    layout.style.setProperty('--sidebar-width', `${width}px`);
  };

  const initializePaneResizing = (): void => {
    const storedWidth = readStoredSidebarWidth();
    if (storedWidth) {
      const layoutRect = layout.getBoundingClientRect();
      const maxWidth = Math.max(layoutRect.width - VIEWER_MIN_WIDTH, SIDEBAR_MIN_WIDTH);
      applySidebarWidth(Math.min(storedWidth, maxWidth));
    }

    const startResize = (event: PointerEvent): void => {
      event.preventDefault();

      const layoutRect = layout.getBoundingClientRect();
      const maxWidth = Math.max(layoutRect.width - VIEWER_MIN_WIDTH, SIDEBAR_MIN_WIDTH);
      const originalUserSelect = document.body.style.userSelect;

      const clampWidth = (clientX: number): number => {
        const rawWidth = clientX - layoutRect.left;
        return Math.min(Math.max(rawWidth, SIDEBAR_MIN_WIDTH), maxWidth);
      };

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        moveEvent.preventDefault();
        const nextWidth = clampWidth(moveEvent.clientX);
        applySidebarWidth(nextWidth);
      };

      const handlePointerUp = (upEvent: PointerEvent): void => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);
        document.body.classList.remove('is-resizing');
        document.body.style.userSelect = originalUserSelect;

        const finalWidth = clampWidth(upEvent.clientX);
        applySidebarWidth(finalWidth);
        storeSidebarWidth(finalWidth);
      };

      document.body.classList.add('is-resizing');
      document.body.style.userSelect = 'none';

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);

      handlePointerMove(event);
    };

    resizeHandle.addEventListener('pointerdown', startResize);
  };

  const registerScrollSync = (activeEditor: MarkdownEditor): void => {
    if (teardownScrollSync) {
      teardownScrollSync();
      teardownScrollSync = null;
    }

    const editorScrollElement = activeEditor.getScrollElement();
    const previewScrollElement = viewer;

    let syncingFromEditor = false;
    let syncingFromPreview = false;
    let editorSyncFrame: number | null = null;
    let previewSyncFrame: number | null = null;

    const cancelFrame = (frame: number | null): void => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };

    const computeScrollRatio = (element: HTMLElement): number => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll <= 0) {
        return 0;
      }
      const ratio = element.scrollTop / maxScroll;
      return Math.max(0, Math.min(1, ratio));
    };

    const applyScrollRatio = (element: HTMLElement, ratio: number): void => {
      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll <= 0) {
        element.scrollTop = 0;
        return;
      }
      element.scrollTop = ratio * maxScroll;
    };

    const syncPreviewToEditor = (): void => {
      const ratio = computeScrollRatio(editorScrollElement);
      syncingFromEditor = true;
      cancelFrame(previewSyncFrame);
      applyScrollRatio(previewScrollElement, ratio);
      previewSyncFrame = window.requestAnimationFrame(() => {
        syncingFromEditor = false;
        previewSyncFrame = null;
      });
    };

    const syncEditorToPreview = (): void => {
      const ratio = computeScrollRatio(previewScrollElement);
      syncingFromPreview = true;
      cancelFrame(editorSyncFrame);
      applyScrollRatio(editorScrollElement, ratio);
      editorSyncFrame = window.requestAnimationFrame(() => {
        syncingFromPreview = false;
        editorSyncFrame = null;
      });
    };

    const handleEditorScroll = (): void => {
      if (!session.isEditing || syncingFromPreview) {
        return;
      }
      syncPreviewToEditor();
    };

    const handlePreviewScroll = (): void => {
      if (!session.isEditing || syncingFromEditor) {
        return;
      }
      syncEditorToPreview();
    };

    editorScrollElement.addEventListener('scroll', handleEditorScroll, { passive: true });
    previewScrollElement.addEventListener('scroll', handlePreviewScroll, { passive: true });

    teardownScrollSync = (): void => {
      editorScrollElement.removeEventListener('scroll', handleEditorScroll);
      previewScrollElement.removeEventListener('scroll', handlePreviewScroll);
      cancelFrame(editorSyncFrame);
      cancelFrame(previewSyncFrame);
      syncingFromEditor = false;
      syncingFromPreview = false;
      requestPreviewAlignment = null;
    };

    requestPreviewAlignment = (): void => {
      syncPreviewToEditor();
    };

    syncPreviewToEditor();
  };

  const updateUiState = (): void => {
    const hasDocument = Boolean(state.path || state.displayPath);

    if (!hasDocument && session.isEditing) {
      session.isEditing = false;
    }

    editorPane.hidden = !session.isEditing || !hasDocument;
    editorPanel.dataset.editing = session.isEditing ? 'true' : 'false';
    editorPanel.classList.toggle('panel-controls--hidden', !hasDocument);
    editToggle.textContent = session.isEditing ? 'Exit Edit Mode' : 'Enter Edit Mode';
    editToggle.setAttribute('aria-pressed', session.isEditing ? 'true' : 'false');
    editToggle.disabled = !hasDocument && !session.isEditing;
    resizeHandle.classList.toggle('resize-handle--active', session.isEditing);
    resizeHandle.hidden = !hasDocument;
    layout.classList.toggle('app-layout--single', !hasDocument);

    const canSave = session.isEditing && session.isDirty && runningInTauri;
    const canRevert = session.isEditing && (session.isDirty || Boolean(state.path) || session.originalContent !== '');
    const canCopy = session.isEditing && hasDocument;

    saveButton.disabled = !canSave;
    revertButton.disabled = !canRevert;
    copyButton.disabled = !canCopy;

    setEditorStatus(session.isDirty ? 'Unsaved changes' : '');
  };

  const ensureEditor = (): MarkdownEditor => {
    if (editor) {
      return editor;
    }

    editor = new MarkdownEditor(editorRoot, {
      initialContent: state.content,
      onChange: (content) => {
        handleEditorContentChange(content);
      },
    });

    registerScrollSync(editor);

    return editor;
  };

  const scheduleLivePreview = (content: string): void => {
    if (livePreviewTimer !== null) {
      window.clearTimeout(livePreviewTimer);
    }

    livePreviewTimer = window.setTimeout(() => {
      void renderMarkdown(content);
    }, 120);
  };

  const renderMarkdown = async (content: string): Promise<void> => {
    const warnings: string[] = [];
    const { html, warnings: renderWarnings } = renderer.render(content);
    if (renderWarnings) {
      warnings.push(...renderWarnings);
    }

    viewer.innerHTML = html;
    viewer.classList.remove('markdown-placeholder');
    const emptyState = viewer.querySelector('[data-empty-state]');
    if (emptyState) {
      emptyState.remove();
    }

    await enhanceMarkdown(viewer, {
      enableSyntaxHighlighting: preferences.preview.enableSyntaxHighlighting,
      enableDiagrams: preferences.preview.enableDiagrams,
      onWarning: (message) => {
        warnings.push(message);
      },
    });

    renderPreviewWarnings(warnings);

    if (session.isEditing) {
      requestPreviewAlignment?.();
    }
  };

  const applyPreviewPreferences = (
    previewPrefs: Preferences['preview'],
    { rerender = true }: { rerender?: boolean } = {},
  ): void => {
    renderer.setMathEnabled(previewPrefs.enableMath);
    mathToggle.checked = previewPrefs.enableMath;
    diagramsToggle.checked = previewPrefs.enableDiagrams;
    syntaxToggle.checked = previewPrefs.enableSyntaxHighlighting;

    if (rerender && state.content) {
      void renderMarkdown(state.content);
    }
  };

  const initializePreferences = async (): Promise<void> => {
    let loaded: Preferences | null = null;

    try {
      loaded = await loadPreferences();
    } catch (error) {
      console.error('Failed to load preferences', error);
    }

    if (loaded) {
      if (preferencesOverride) {
        const currentPreview = preferences.preview;
        preferences = {
          ...loaded,
          preview: {
            ...loaded.preview,
            ...currentPreview,
          },
        };
      } else {
        preferences = loaded;
      }
    } else if (!preferencesOverride) {
      preferences = getDefaultPreferences();
    }

    applyPreviewPreferences(preferences.preview, { rerender: Boolean(state.content) });
  };

  const renderRecentFiles = (files: FileMetadata[]): void => {
    recentList.innerHTML = '';
    recentSection.hidden = files.length === 0;

    if (files.length === 0) {
      return;
    }

    files.forEach((file) => {
      const item = document.createElement('li');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-item__button';
      button.title = file.path;

      const name = document.createElement('span');
      name.className = 'recent-item__name';
      name.textContent = getFileName(file.path);

      const details = document.createElement('span');
      details.className = 'recent-item__details';
      const updated = formatTimestamp(file.lastModified) ?? '—';
      details.textContent = `${truncatePath(file.path)} • ${formatBytes(file.size)} • ${updated}`;

      button.append(name, details);
      button.addEventListener('click', () => {
        void loadFromPath(file.path);
      });

      item.append(button);
      recentList.append(item);
    });
  };

  const refreshRecents = async (): Promise<void> => {
    if (!runningInTauri) {
      return;
    }

    try {
      const files = await listRecentFiles();
      renderRecentFiles(files);
    } catch (error) {
      console.error('Unable to load recent files', error);
    }
  };

  const loadFromPath = async (path: string): Promise<void> => {
    try {
      setStatus('Loading markdown…', 'info');
      const file = await readFileContent(path);
      if (livePreviewTimer !== null) {
        window.clearTimeout(livePreviewTimer);
        livePreviewTimer = null;
      }

      await renderMarkdown(file.content);

      state.path = file.path;
      state.displayPath = file.path;
      state.size = file.size;
      state.lastModified = formatTimestamp(file.lastModified);
      state.content = file.content;

      session.originalContent = file.content;
      session.isDirty = false;

      if (editor) {
        editor.setContent(file.content);
      }

      updateMeta(state);
      updateUiState();

      if (runningInTauri) {
        void registerRecentFile(file.path)
          .then(() => refreshRecents())
          .catch((recentError) => {
            console.error('Unable to add file to recents', recentError);
          });
      }

      setEditorStatus('');
      setStatus(`Rendered ${truncatePath(file.path)}`);
    } catch (error) {
      console.error('Unable to load markdown file', error);
      setStatus('Unable to open that file. Please verify it is a readable Markdown document.', 'error');
    }
  };

  const handleEditorContentChange = (content: string): void => {
    state.content = content;
    state.size = encoder.encode(content).length;
    session.isDirty = content !== session.originalContent;

    updateMeta(state);
    updateUiState();
    scheduleLivePreview(content);

    if (session.isDirty) {
      setStatus('Unsaved changes — live preview updated', 'info');
    } else if (state.displayPath) {
      setStatus(`Rendered ${truncatePath(state.displayPath)}`);
    } else {
      setStatus('Preview updated.');
    }
  };

  const handleDialogSelection = async (): Promise<void> => {
    const selected = await pickFile();
    if (!selected) {
      return;
    }
    await loadFromPath(selected);
  };

  const toggleEditing = (): void => {
    const hasDocument = Boolean(state.path || state.displayPath);
    if (!hasDocument) {
      setStatus('Open a document before entering edit mode.', 'error');
      return;
    }

    session.isEditing = !session.isEditing;

    if (session.isEditing) {
      const activeEditor = ensureEditor();
      updateUiState();
      requestPreviewAlignment?.();
      window.requestAnimationFrame(() => {
        activeEditor.focus();
        requestPreviewAlignment?.();
      });
      setStatus('Edit mode enabled. Changes sync to the preview automatically.', 'info');
    } else {
      updateUiState();
      setStatus(`Viewing ${describeCurrentFile()}`);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!runningInTauri) {
      setStatus('Saving is only available in the desktop app.', 'error');
      return;
    }

    const activeEditor = editor ?? (session.isEditing ? ensureEditor() : null);
    const content = activeEditor ? activeEditor.getContent() : state.content;

    try {
      if (!state.path) {
        const suggestedName = state.displayPath ?? 'untitled.md';
        const target = await saveFileAs(suggestedName);
        if (!target) {
          setStatus('Save cancelled.');
          return;
        }
        state.path = target;
        state.displayPath = target;
      }

      if (!state.path) {
        throw new Error('File path missing after save dialog.');
      }

      const result = await writeFileContent(state.path, content);

      state.path = result.path;
      state.displayPath = result.path;
      state.size = result.size;
      state.lastModified = formatTimestamp(result.lastModified);
      state.content = content;

      session.originalContent = content;
      session.isDirty = false;

      updateMeta(state);
      updateUiState();
      setEditorStatus('');
      setStatus(`Saved ${describeCurrentFile()}`);

      void registerRecentFile(result.path)
        .then(() => refreshRecents())
        .catch((recentError) => {
          console.error('Unable to add file to recents', recentError);
        });
    } catch (error) {
      console.error('Unable to save markdown file', error);
      setStatus('Unable to save the file. Please try again.', 'error');
    }
  };

  const handleRevert = async (): Promise<void> => {
    if (!session.isEditing) {
      return;
    }

    if (runningInTauri && state.path) {
      await loadFromPath(state.path);
      setStatus(`Reverted to saved ${describeCurrentFile()}`, 'info');
      return;
    }

    if (livePreviewTimer !== null) {
      window.clearTimeout(livePreviewTimer);
      livePreviewTimer = null;
    }

    const baseline = session.originalContent;
    state.content = baseline;
    state.size = encoder.encode(baseline).length;
    session.isDirty = false;

    if (editor) {
      editor.setContent(baseline);
    }

    updateMeta(state);
    updateUiState();
    await renderMarkdown(baseline);
    setEditorStatus('');
    setStatus('Reverted changes.');
  };

  const handleCopy = async (): Promise<void> => {
    if (!session.isEditing) {
      setStatus('Enter edit mode to copy the raw markdown.', 'error');
      return;
    }

    const activeEditor = editor ?? ensureEditor();
    const content = activeEditor.getContent();

    if (!content) {
      setStatus('Nothing to copy yet.', 'error');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }

      setStatus('Copied raw markdown to clipboard.', 'info');
    } catch (error) {
      console.error('Unable to copy markdown', error);
      setStatus('Unable to copy markdown to the clipboard.', 'error');
    }
  };

  const createTabElement = (id: string, title: string): HTMLElement => {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tabId = id;

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab__title';
    tabTitle.textContent = title;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'tab__close';
    closeButton.textContent = '×';
    closeButton.title = 'Close tab';
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });

    tab.append(tabTitle, closeButton);
    tab.addEventListener('click', () => switchToTab(id));

    return tab;
  };

  const saveCurrentTabState = (): void => {
    if (!activeTabId) return;

    const tab = tabs.get(activeTabId);
    if (!tab) return;

    tab.viewerState = { ...state };
    tab.sessionState = { ...session };
    tab.editorContent = editor?.getContent() ?? null;
  };

  const restoreTabState = (tabId: string): void => {
    const tab = tabs.get(tabId);
    if (!tab) return;

    // Restore viewer state
    Object.assign(state, tab.viewerState);

    // Restore session state
    Object.assign(session, tab.sessionState);

    // Restore editor content
    if (tab.editorContent !== null && editor) {
      editor.setContent(tab.editorContent);
    } else if (session.isEditing) {
      const activeEditor = ensureEditor();
      activeEditor.setContent(state.content);
    }

    updateMeta(state);
    updateUiState();
    void renderMarkdown(state.content);
  };

  const createNewTab = async (): Promise<string> => {
    const id = `tab-${++tabIdCounter}`;
    const title = `Untitled ${tabIdCounter}`;

    const newTabState: TabState = {
      id,
      viewerState: {
        path: null,
        displayPath: title,
        size: 0,
        lastModified: null,
        content: '',
      },
      sessionState: {
        isEditing: true,
        isDirty: false,
        originalContent: '',
      },
      editorContent: '',
    };

    tabs.set(id, newTabState);

    const tabElement = createTabElement(id, title);
    tabList.append(tabElement);

    return id;
  };

  const switchToTab = (tabId: string): void => {
    if (activeTabId === tabId) return;

    // Save current tab state
    if (activeTabId) {
      saveCurrentTabState();

      const oldTab = tabList.querySelector(`[data-tab-id="${activeTabId}"]`);
      if (oldTab) {
        oldTab.classList.remove('tab--active');
      }
    }

    // Switch to new tab
    activeTabId = tabId;
    const newTab = tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (newTab) {
      newTab.classList.add('tab--active');
    }

    restoreTabState(tabId);
  };

  const closeTab = (tabId: string): void => {
    const tab = tabs.get(tabId);
    if (!tab) return;

    // Check if tab has unsaved changes
    if (tab.sessionState.isDirty) {
      if (!confirm(`"${tab.viewerState.displayPath}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }

    // Remove tab element
    const tabElement = tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabElement) {
      tabElement.remove();
    }

    // Remove from tabs map
    tabs.delete(tabId);

    // If this was the active tab, switch to another tab
    if (activeTabId === tabId) {
      const remainingTabs = Array.from(tabs.keys());
      if (remainingTabs.length > 0) {
        switchToTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        // No tabs left - reset to empty state
        activeTabId = null;
        Object.assign(state, {
          path: null,
          displayPath: null,
          size: 0,
          lastModified: null,
          content: '',
        });
        Object.assign(session, {
          isEditing: false,
          isDirty: false,
          originalContent: '',
        });
        updateMeta(state);
        updateUiState();
      }
    }
  };

  const handleNewDocument = async (): Promise<void> => {
    // Create a new tab
    const tabId = await createNewTab();
    switchToTab(tabId);

    setEditorStatus('');
    setStatus('New document created. Start typing!', 'info');

    window.requestAnimationFrame(() => {
      const activeEditor = ensureEditor();
      activeEditor.focus();
    });
  };

  const handleMarkdownTool = (tool: string): void => {
    if (!session.isEditing) {
      setStatus('Enter edit mode to use markdown tools.', 'error');
      return;
    }

    const activeEditor = editor ?? ensureEditor();
    activeEditor.insertMarkdown(tool);
  };

  const registerMenuListeners = async (): Promise<void> => {
    try {
      const disposers: UnlistenFn[] = [];

      const unlistenOpen = await listen(MENU_OPEN_EVENT, () => {
        void handleDialogSelection();
      });
      disposers.push(unlistenOpen);

      const unlistenRecent = await listen<string>(MENU_OPEN_RECENT_EVENT, (event) => {
        const recentPath = event.payload;
        if (!recentPath) {
          return;
        }
        void loadFromPath(recentPath);
      });
      disposers.push(unlistenRecent);

      window.addEventListener(
        'beforeunload',
        () => {
          disposers.forEach((dispose) => {
            void dispose();
          });
        },
        { once: true },
      );
    } catch (error) {
      console.warn('Unable to register menu listeners', error);
    }
  };

  editToggle.addEventListener('click', () => {
    toggleEditing();
  });

  saveButton.addEventListener('click', () => {
    void handleSave();
  });

  revertButton.addEventListener('click', () => {
    void handleRevert();
  });

  copyButton.addEventListener('click', () => {
    void handleCopy();
  });

  newDocButton.addEventListener('click', () => {
    void handleNewDocument();
  });

  newTabButton.addEventListener('click', () => {
    void handleNewDocument();
  });

  mdToolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tool = button.dataset.mdTool;
      if (tool) {
        handleMarkdownTool(tool);
      }
    });
  });

  const switchView = (viewName: string): void => {
    const isViewerView = viewName === 'viewer';
    const isSettingsView = viewName === 'settings';
    const isAboutView = viewName === 'about';

    layout.hidden = !isViewerView;
    settingsView.hidden = !isSettingsView;
    aboutView.hidden = !isAboutView;

    navLinks.forEach((link) => {
      const linkView = link.dataset.navLink;
      if (linkView === viewName) {
        link.classList.add('nav-link--active');
      } else {
        link.classList.remove('nav-link--active');
      }
    });
  };

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const viewName = link.dataset.navLink;
      if (viewName) {
        switchView(viewName);
      }
    });
  });

  const handlePreviewToggle = (
    checkbox: HTMLInputElement,
    key: keyof Preferences['preview'],
    label: string,
  ): void => {
    const enabled = checkbox.checked;
    preferencesOverride = true;

    const nextPreview = {
      ...preferences.preview,
      [key]: enabled,
    } as Preferences['preview'];

    preferences = {
      ...preferences,
      preview: nextPreview,
    };

    applyPreviewPreferences(nextPreview, { rerender: Boolean(state.content) });

    const previewUpdate = { [key]: enabled } as Partial<Preferences['preview']>;

    void updatePreferences({ preview: previewUpdate })
      .then((updated) => {
        preferences = {
          ...updated,
          preview: {
            ...updated.preview,
            ...nextPreview,
          },
        };
      })
      .catch((error) => {
        console.error('Failed to persist preview preferences', error);
      });

    setStatus(`${label} ${enabled ? 'enabled' : 'disabled'}.`, 'info');
  };

  const previewToggleConfigs: Array<{ element: HTMLInputElement; key: keyof Preferences['preview']; label: string }> = [
    { element: mathToggle, key: 'enableMath', label: 'Math rendering' },
    { element: diagramsToggle, key: 'enableDiagrams', label: 'Diagram rendering' },
    { element: syntaxToggle, key: 'enableSyntaxHighlighting', label: 'Syntax highlighting' },
  ];

  previewToggleConfigs.forEach(({ element, key, label }) => {
    element.addEventListener('change', () => {
      handlePreviewToggle(element, key, label);
    });
  });

  if (runningInTauri) {
    void registerMenuListeners();
  }

  openTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      void handleDialogSelection();
    });
  });

  window.addEventListener(
    'beforeunload',
    () => {
      teardownScrollSync?.();
    },
    { once: true },
  );

  const restoreCollapsibleState = (): void => {
    try {
      const activeDocCollapsed = window.localStorage.getItem(ACTIVE_DOC_COLLAPSED_KEY);
      const recentDocCollapsed = window.localStorage.getItem(RECENT_DOC_COLLAPSED_KEY);

      if (activeDocCollapsed === 'false') {
        activeDocDetails.open = true;
      }

      if (recentDocCollapsed === 'false') {
        recentDetails.open = true;
      }
    } catch (error) {
      console.warn('Unable to restore collapsible section state', error);
    }
  };

  const persistCollapsibleState = (): void => {
    try {
      window.localStorage.setItem(ACTIVE_DOC_COLLAPSED_KEY, String(!activeDocDetails.open));
      window.localStorage.setItem(RECENT_DOC_COLLAPSED_KEY, String(!recentDetails.open));
    } catch (error) {
      console.warn('Unable to persist collapsible section state', error);
    }
  };

  activeDocDetails.addEventListener('toggle', () => {
    persistCollapsibleState();
  });

  recentDetails.addEventListener('toggle', () => {
    persistCollapsibleState();
  });

  setStatus('Waiting for a Markdown file…');
  updateMeta(state);
  updateUiState();
  void initializePreferences();
  initializePaneResizing();
  restoreCollapsibleState();
  void refreshRecents();

  // Initialize with viewer view active
  switchView('viewer');
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return '—';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function isMarkdownFile(path: string): boolean {
  return /\.(md|markdown|mdown)$/i.test(path);
}

function truncatePath(path: string): string {
  if (path.length <= 64) {
    return path;
  }
  return `…${path.slice(-61)}`;
}

function getFileName(path: string): string {
  const segments = path.split(/[/\\]/);
  const name = segments.pop();
  if (!name || name.length === 0) {
    return path;
  }
  return name;
}

function formatTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString();
}
