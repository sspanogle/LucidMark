import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

import { MarkdownEditor } from '@editor/markdown-editor';
import {
  clearRecentFiles,
  listRecentFiles,
  pickFile,
  readFileContent,
  registerRecentFile,
  removeRecentFile,
  saveFileAs,
  writeFileContent,
} from '@file-system/file-system-service';
import { enhanceMarkdown } from '@renderer/enhance-markdown';
import { MarkdownRenderer } from '@renderer/markdown-renderer';
import type { FileMetadata } from '@shared-types/files';
import { getDefaultPreferences, loadPreferences, updatePreferences } from '@settings/preferences-store';
import type { Preferences } from '@shared-types/settings';
import { exportDocument } from '@export/export-service';

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
  const openTriggers = Array.from(root?.querySelectorAll<HTMLElement>('[data-open-trigger]') ?? []);
  const mathToggle = root?.querySelector<HTMLInputElement>('[data-math-toggle]');
  const diagramsToggle = root?.querySelector<HTMLInputElement>('[data-diagrams-toggle]');
  const syntaxToggle = root?.querySelector<HTMLInputElement>('[data-syntax-toggle]');
  const resizeHandle = root?.querySelector<HTMLElement>('[data-resize-handle]');
  const editorPanel = root?.querySelector<HTMLElement>('[data-editor-panel]');
  const editorPane = root?.querySelector<HTMLElement>('[data-editor-pane]');
  const editorToolbar = root?.querySelector<HTMLElement>('[data-editor-toolbar]');
  const editorRoot = root?.querySelector<HTMLElement>('[data-editor-root]');
  const editorStatus = root?.querySelector<HTMLElement>('[data-editor-status]');
  const editToggle = root?.querySelector<HTMLButtonElement>('[data-edit-toggle]');
  const viewModeControls = root?.querySelector<HTMLElement>('[data-view-controls]');
  const viewToggle = viewModeControls?.querySelector<HTMLButtonElement>('[data-view-toggle]') ?? null;
  const saveButton = root?.querySelector<HTMLButtonElement>('[data-save]');
  const revertButton = root?.querySelector<HTMLButtonElement>('[data-revert]');
  const copyButton = root?.querySelector<HTMLButtonElement>('[data-copy]');
  const mdToolButtons = Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-md-tool]') ?? []);
  const initialViewerMarkup = viewer?.innerHTML ?? '';
  const recentCards = root?.querySelector<HTMLElement>('[data-recent-cards]');
  const recentCardsGrid = root?.querySelector<HTMLElement>('[data-recent-cards-grid]');
  const clearRecentsButton = root?.querySelector<HTMLButtonElement>('[data-clear-recents]');
  const dropZone = root?.querySelector<HTMLElement>('[data-drop-zone]');
  const dropZoneSelect = root?.querySelector<HTMLButtonElement>('[data-drop-zone-select]');
  const navLinks = Array.from(root?.querySelectorAll<HTMLAnchorElement>('[data-nav-link]') ?? []);
  const settingsView = root?.querySelector<HTMLElement>('[data-settings-view]');
  const aboutView = root?.querySelector<HTMLElement>('[data-about-view]');
  const tabBar = root?.querySelector<HTMLElement>('[data-tab-bar]');
  const tabList = root?.querySelector<HTMLElement>('[data-tab-list]');
  const newTabButton = root?.querySelector<HTMLButtonElement>('[data-new-tab]');
  const viewerSections = Array.from(root?.querySelectorAll<HTMLElement>('[data-viewer-section]') ?? []);
  const exportPdfButton = root?.querySelector<HTMLButtonElement>('[data-export-pdf]');
  const exportWordButton = root?.querySelector<HTMLButtonElement>('[data-export-word]');
  const recentsTrigger = root?.querySelector<HTMLButtonElement>('[data-recents-trigger]');
  const openLocationButton = root?.querySelector<HTMLButtonElement>('[data-open-location]');

  if (
    !root ||
    !layout ||
    !viewer ||
    !statusLine ||
    !mathToggle ||
    !diagramsToggle ||
    !syntaxToggle ||
    !resizeHandle ||
    !editorPanel ||
    !editorPane ||
    !editorToolbar ||
    !editorRoot ||
    !editorStatus ||
    !editToggle ||
    !saveButton ||
    !revertButton ||
    !copyButton ||
    !settingsView ||
    !aboutView ||
    !tabBar ||
    !tabList ||
    !newTabButton ||
    !viewModeControls ||
    !viewToggle
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

  const resetViewer = (): void => {
    viewer.innerHTML = initialViewerMarkup;
    viewer.classList.add('markdown-placeholder');
    renderPreviewWarnings([]);
  };

  const ensureMarkdownExtension = (name: string): string => {
    if (isMarkdownFile(name)) {
      return name;
    }
    return `${name}.md`;
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

  const updateTabTooltip = (tabId: string): void => {
    const tab = tabs.get(tabId);
    if (!tab) return;

    const tabElement = tabList.querySelector<HTMLElement>(`[data-tab-id="${tabId}"]`);
    if (!tabElement) return;

    // Remove existing tooltip
    const existingTooltip = tabElement.querySelector('.tab__tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    // Only add tooltip if there's a path
    if (tab.viewerState.path) {
      const tooltip = document.createElement('div');
      tooltip.className = 'tab__tooltip';

      const pathLine = document.createElement('span');
      pathLine.className = 'tab__tooltip-line';
      pathLine.textContent = tab.viewerState.path;

      const sizeLine = document.createElement('span');
      sizeLine.className = 'tab__tooltip-line';
      sizeLine.textContent = `Size: ${formatBytes(tab.viewerState.size)}`;

      const statusLine = document.createElement('span');
      statusLine.className = 'tab__tooltip-line';
      const statusText = tab.sessionState.isDirty
        ? 'Unsaved changes'
        : (tab.viewerState.lastModified ?? '—');
      statusLine.textContent = `Updated: ${statusText}`;

      tooltip.append(pathLine, sizeLine, statusLine);
      tabElement.append(tooltip);
    }
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
    const hasFilePath = Boolean(state.path);

    if (!hasDocument && session.isEditing) {
      session.isEditing = false;
    }

    const editorActive = session.isEditing && hasDocument;

    // Show/hide "Open Location" button
    if (openLocationButton) {
      openLocationButton.hidden = !hasFilePath || !runningInTauri;
    }

    editorPane.hidden = !editorActive;
    editorToolbar.hidden = !editorActive;
    editorPanel.dataset.editing = session.isEditing ? 'true' : 'false';
    editorPanel.classList.toggle('panel-controls--hidden', !editorActive);
    editorPanel.hidden = !editorActive;

    const editLabel = session.isEditing ? 'Exit Edit Mode' : 'Enter Edit Mode';
    editToggle.setAttribute('aria-pressed', session.isEditing ? 'true' : 'false');
    editToggle.setAttribute('aria-label', editLabel);
    editToggle.title = editLabel;
    editToggle.disabled = !hasDocument;
    editToggle.classList.toggle('mode-toggle__button--active', session.isEditing);
    editToggle.dataset.editing = session.isEditing ? 'true' : 'false';

    viewToggle.setAttribute('aria-pressed', session.isEditing ? 'false' : 'true');
    viewToggle.disabled = !hasDocument;
    viewToggle.classList.toggle('mode-toggle__button--active', !session.isEditing);

    viewModeControls.hidden = !hasDocument;

    if (recentCards) {
      const hasRecentItems = recentCards.dataset.hasItems === 'true';
      recentCards.hidden = !hasRecentItems || hasDocument;
    }

    resizeHandle.classList.toggle('resize-handle--active', editorActive);
    resizeHandle.hidden = !editorActive;
    layout.classList.toggle('app-layout--single', !editorActive);

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
    if (recentCardsGrid) {
      recentCardsGrid.innerHTML = '';
    }

    const hasDocument = Boolean(state.path || state.displayPath);
    const hasRecentItems = files.length > 0;

    if (recentCards) {
      recentCards.dataset.hasItems = String(hasRecentItems);
      recentCards.hidden = !hasRecentItems || hasDocument;
    }

    if (dropZone) {
      dropZone.hidden = hasRecentItems || hasDocument;
    }

    if (files.length === 0) {
      return;
    }

    if (recentCardsGrid) {
      files.slice(0, 6).forEach((file) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'recent-card';

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'recent-card__remove';
        removeButton.textContent = '×';
        removeButton.title = 'Remove from recents';
        removeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          void handleRemoveRecent(file.path);
        });

        const cardName = document.createElement('p');
        cardName.className = 'recent-card__name';
        cardName.textContent = getFileName(file.path);

        const infoIcon = document.createElement('div');
        infoIcon.className = 'recent-card__info-icon';
        infoIcon.textContent = 'i';

        const tooltip = document.createElement('div');
        tooltip.className = 'recent-card__tooltip';

        const pathLine = document.createElement('span');
        pathLine.className = 'recent-card__tooltip-line';
        pathLine.textContent = file.path;

        const sizeLine = document.createElement('span');
        sizeLine.className = 'recent-card__tooltip-line';
        sizeLine.textContent = `Size: ${formatBytes(file.size)}`;

        const dateLine = document.createElement('span');
        dateLine.className = 'recent-card__tooltip-line';
        const updated = formatTimestamp(file.lastModified) ?? '—';
        dateLine.textContent = `Modified: ${updated}`;

        tooltip.append(pathLine, sizeLine, dateLine);
        infoIcon.append(tooltip);
        card.append(removeButton, cardName, infoIcon);

        card.addEventListener('click', () => {
          void loadFromPath(file.path);
        });

        recentCardsGrid.append(card);
      });
    }
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

  const handleClearRecents = async (): Promise<void> => {
    if (!runningInTauri) {
      return;
    }

    if (!confirm('Clear all recent documents? This will not delete the files.')) {
      return;
    }

    try {
      await clearRecentFiles();
      await refreshRecents();
      setStatus('Recent documents cleared.', 'info');
    } catch (error) {
      console.error('Unable to clear recent files', error);
      setStatus('Unable to clear recent documents.', 'error');
    }
  };

  const handleRemoveRecent = async (path: string): Promise<void> => {
    if (!runningInTauri) {
      return;
    }

    try {
      await removeRecentFile(path);
      await refreshRecents();
      setStatus('Removed from recent documents.', 'info');
    } catch (error) {
      console.error('Unable to remove recent file', error);
      setStatus('Unable to remove from recents.', 'error');
    }
  };

  const loadFromPath = async (path: string): Promise<void> => {
    try {
      setStatus('Loading markdown…', 'info');
      const file = await readFileContent(path);
      const tabId = ensureActiveTabForFile(file.path);
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
      session.isEditing = false;

      if (editor) {
        editor.setContent(file.content);
      }

      switchView('viewer');

      updateUiState();
      setTabTitle(tabId, getFileName(file.path));
      updateTabTooltip(tabId);
      saveCurrentTabState();

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

    updateUiState();
    if (activeTabId) {
      updateTabTooltip(activeTabId);
    }
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
		setStatus('Opening Markdown file picker...');
		try {
			const selected = await pickFile();
			if (!selected) {
				setStatus('Open cancelled.');
				return;
			}
			await loadFromPath(selected);
		} catch (error) {
			console.error('Failed to open file picker:', error);
			setStatus('Unable to open file picker. Check desktop permissions and try again.', 'error');
		}
	};

  const toggleEditing = (): void => {
    const hasDocument = Boolean(state.path || state.displayPath);
    if (!hasDocument) {
      setStatus('Open a document before entering edit mode.', 'error');
      return;
    }

    switchView('viewer');
    session.isEditing = !session.isEditing;

    if (session.isEditing) {
      const activeEditor = ensureEditor();
      updateUiState();
      registerScrollSync(activeEditor);
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

    // Save the updated editing state to the current tab
    saveCurrentTabState();
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

      updateUiState();
      if (activeTabId) {
        updateTabTooltip(activeTabId);
      }
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

    updateUiState();
    if (activeTabId) {
      updateTabTooltip(activeTabId);
    }
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
    tab.addEventListener('dblclick', () => {
      renameTab(id);
    });

    return tab;
  };

  function renameTab(tabId: string, providedTitle?: string | null): void {
    const tabState = tabs.get(tabId);
    if (!tabState) {
      return;
    }

    if (tabState.viewerState.path) {
      return;
    }

    const currentTitle = tabState.viewerState.displayPath ?? `Untitled ${tabId.replace('tab-', '')}`;

    let nextTitle: string | null;

    if (typeof providedTitle === 'string') {
      nextTitle = providedTitle.trim();
    } else if (providedTitle === null) {
      return;
    } else {
      const response = window.prompt('Name this document', currentTitle) ?? '';
      nextTitle = response.trim();
    }

    if (!nextTitle) {
      return;
    }

    const normalizedTitle = ensureMarkdownExtension(nextTitle);
    tabState.viewerState.displayPath = normalizedTitle;
    setTabTitle(tabId, normalizedTitle);

    if (activeTabId === tabId) {
      state.displayPath = normalizedTitle;
      updateTabTooltip(tabId);
    }
  }

  function registerTab(id: string, title: string, tabState: TabState): void {
    if (!tabList) {
      return;
    }
    tabs.set(id, tabState);
    const tabElement = createTabElement(id, title);
    tabList.append(tabElement);
  }

  function setTabTitle(tabId: string, title: string): void {
    if (!tabList) {
      return;
    }
    const tabElement = tabList.querySelector<HTMLElement>(`[data-tab-id="${tabId}"] .tab__title`);
    if (tabElement) {
      tabElement.textContent = title;
    }
  }

  function findTabByPath(filePath: string): string | null {
    for (const [id, tabState] of tabs.entries()) {
      if (tabState.viewerState.path === filePath) {
        return id;
      }
    }
    return null;
  }

  function ensureActiveTabForFile(filePath: string): string {
    const title = getFileName(filePath);

    const existingTabId = findTabByPath(filePath);
    if (existingTabId) {
      if (activeTabId !== existingTabId) {
        switchToTab(existingTabId);
      }
      setTabTitle(existingTabId, title);
      return existingTabId;
    }

    if (activeTabId) {
      const activeTabState = tabs.get(activeTabId);
      if (activeTabState && !activeTabState.viewerState.path) {
        activeTabState.viewerState.path = filePath;
        activeTabState.viewerState.displayPath = filePath;
        setTabTitle(activeTabId, title);
        return activeTabId;
      }
    }

    const id = `tab-${++tabIdCounter}`;
    const tabState: TabState = {
      id,
      viewerState: {
        path: filePath,
        displayPath: filePath,
        size: 0,
        lastModified: null,
        content: '',
      },
      sessionState: {
        isEditing: false,
        isDirty: false,
        originalContent: '',
      },
      editorContent: '',
    };

    registerTab(id, title, tabState);
    switchToTab(id);
    return id;
  }

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

    // Update UI to reflect this tab's editing state
    updateUiState();
    if (tabId && activeTabId === tabId) {
      updateTabTooltip(tabId);
    }
    void renderMarkdown(state.content);

    // Restore scroll sync if in editing mode
    if (session.isEditing && editor) {
      registerScrollSync(editor);
      requestPreviewAlignment?.();
    }
  };

  interface CreateTabOptions {
    readonly promptForName?: boolean;
    readonly defaultName?: string;
  }

  const createNewTab = async (options: CreateTabOptions = {}): Promise<string> => {
    const { promptForName = true, defaultName } = options;
    const id = `tab-${++tabIdCounter}`;
    const title = defaultName ?? `Untitled ${tabIdCounter}`;

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
        isEditing: false,
        isDirty: false,
        originalContent: '',
      },
      editorContent: '',
    };

    registerTab(id, title, newTabState);

    if (promptForName) {
      const providedName = window.prompt('Name this document', title);
      if (providedName) {
        renameTab(id, providedName);
      }
    } else if (defaultName) {
      renameTab(id, defaultName);
    }

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
    if (tabId === activeTabId) {
      saveCurrentTabState();
    }

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
        resetViewer();
        updateUiState();
        setStatus('Waiting for a Markdown file…');
      }
    }
  };

  const handleNewDocument = async (): Promise<void> => {
    // Create a new tab
    const tabId = await createNewTab();
    switchToTab(tabId);

    setEditorStatus('');
    setStatus('New document ready. Enter edit mode to begin writing.', 'info');

    window.requestAnimationFrame(() => {
      // Focus happens when entering edit mode.
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

  const handleExport = async (format: 'pdf' | 'docx'): Promise<void> => {
    const hasDocument = Boolean(state.path || state.displayPath);
    if (!hasDocument) {
      setStatus('Open a document before exporting.', 'error');
      return;
    }

    try {
      setStatus(`Preparing ${format.toUpperCase()} export...`, 'info');

      const filename = state.displayPath
        ? getFileName(state.displayPath).replace(/\.(md|markdown|mdown)$/i, '')
        : 'document';

      // Calculate save path if we have a file path (for Tauri)
      let savePath: string | undefined;
      if (state.path && runningInTauri) {
        // Replace the .md extension with the export format extension
        savePath = state.path.replace(/\.(md|markdown|mdown)$/i, `.${format}`);
      }

		await exportDocument(viewer, {
			filename,
			format,
			...(savePath ? { savePath } : {}),
		});

      if (savePath) {
        setStatus(`Exported to ${truncatePath(savePath)}`, 'info');
      } else {
        setStatus(`Successfully exported as ${format.toUpperCase()}.`, 'info');
      }
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
      setStatus(`Failed to export ${format.toUpperCase()}. Please try again.`, 'error');
    }
  };

  const handleShowRecents = (): void => {
    // Close all tabs to return to the empty/recents state
    const allTabs = Array.from(tabs.keys());

    // Check if any tabs have unsaved changes
    const unsavedTabs = allTabs.filter(tabId => {
      const tab = tabs.get(tabId);
      return tab?.sessionState.isDirty;
    });

    if (unsavedTabs.length > 0) {
      const tabNames = unsavedTabs
        .map(tabId => tabs.get(tabId)?.viewerState.displayPath || 'Untitled')
        .join(', ');
      if (!confirm(`${unsavedTabs.length} tab(s) have unsaved changes (${tabNames}). Close anyway?`)) {
        return;
      }
    }

    // Clear all tabs
    allTabs.forEach(tabId => {
      const tabElement = tabList.querySelector(`[data-tab-id="${tabId}"]`);
      if (tabElement) {
        tabElement.remove();
      }
      tabs.delete(tabId);
    });

    // Reset to empty state
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

    resetViewer();
    updateUiState();
    setStatus('Viewing recent documents');

    // Refresh recents to show the cards
    void refreshRecents();
  };

  const handleOpenLocation = async (): Promise<void> => {
    if (!runningInTauri) {
      setStatus('Opening file location is only available in the desktop app.', 'error');
      return;
    }

    if (!state.path) {
      setStatus('No file location available for unsaved documents.', 'error');
      return;
    }

    try {
      // Reveal the file in the system's file explorer
      await revealItemInDir(state.path);
      setStatus(`Revealed ${getFileName(state.path)} in file explorer`, 'info');
    } catch (error) {
      console.error('Failed to open file location:', error);
      setStatus('Unable to open file location.', 'error');
    }
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

  viewToggle.addEventListener('click', () => {
    if (!session.isEditing) {
      return;
    }

    session.isEditing = false;
    updateUiState();
    setStatus(`Viewing ${describeCurrentFile()}`);

    // Save the updated editing state to the current tab
    saveCurrentTabState();
  });

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

  if (exportPdfButton) {
    exportPdfButton.addEventListener('click', () => {
      void handleExport('pdf');
    });
  }

  if (exportWordButton) {
    exportWordButton.addEventListener('click', () => {
      void handleExport('docx');
    });
  }

  if (recentsTrigger) {
    recentsTrigger.addEventListener('click', () => {
      handleShowRecents();
    });
  }

  if (openLocationButton) {
    openLocationButton.addEventListener('click', () => {
      void handleOpenLocation();
    });
  }

  function switchView(viewName: string): void {
    if (!root || !layout || !settingsView || !aboutView) {
      return;
    }

    const isViewerView = viewName === 'viewer';
    const isSettingsView = viewName === 'settings';
    const isAboutView = viewName === 'about';

    layout.hidden = !isViewerView;
    settingsView.hidden = !isSettingsView;
    aboutView.hidden = !isAboutView;

    root.setAttribute('data-active-view', viewName);

    viewerSections.forEach((section) => {
      section.hidden = !isViewerView;
    });

    navLinks.forEach((link) => {
      const linkView = link.dataset.navLink;
      if (linkView === viewName) {
        link.classList.add('nav-link--active');
      } else {
        link.classList.remove('nav-link--active');
      }
    });
  }

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

  if (clearRecentsButton) {
    clearRecentsButton.addEventListener('click', () => {
      void handleClearRecents();
    });
  }

  if (dropZoneSelect) {
    dropZoneSelect.addEventListener('click', () => {
      void handleDialogSelection();
    });
  }

  if (dropZone && runningInTauri) {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent): void => {
      e.preventDefault();
      dragCounter++;
      dropZone.classList.add('drop-zone--active');
    };

    const handleDragLeave = (e: DragEvent): void => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        dropZone.classList.remove('drop-zone--active');
      }
    };

    const handleDragOver = (e: DragEvent): void => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault();
      dragCounter = 0;
      dropZone.classList.remove('drop-zone--active');

      const files = Array.from(e.dataTransfer?.files ?? []);
      const mdFile = files.find((file) => /\.(md|markdown|mdown)$/i.test(file.name));

      if (mdFile) {
        const path = (mdFile as File & { path?: string }).path;
        if (path) {
          await loadFromPath(path);
        }
      } else {
        setStatus('Please drop a Markdown file (.md, .markdown, or .mdown).', 'error');
      }
    };

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', (e) => {
      void handleDrop(e);
    });
  }

  window.addEventListener(
    'beforeunload',
    () => {
      teardownScrollSync?.();
    },
    { once: true },
  );


  setStatus('Waiting for a Markdown file…');
  void initializePreferences();
  initializePaneResizing();
  void refreshRecents();
  // Initialize with viewer view active
  switchView('viewer');
  updateUiState();
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

function isMarkdownFile(pathOrName: string): boolean {
  return /\.(md|markdown|mdown)$/i.test(pathOrName);
}
