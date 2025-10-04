import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, drawSelection } from '@codemirror/view';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

type ChangeHandler = (content: string) => void;

interface MarkdownEditorOptions {
  readonly initialContent?: string;
  readonly onChange: ChangeHandler;
}

export class MarkdownEditor {
  private readonly view: EditorView;
  private suppressChange = false;

  constructor(host: HTMLElement, options: MarkdownEditorOptions) {
    const extensions: Extension[] = [
      history(),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightActiveLine(),
      drawSelection(),
      highlightSelectionMatches(),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          backgroundColor: 'transparent',
        },
        '.cm-content': {
          padding: '1rem 1.25rem',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: '1px solid rgba(15, 15, 15, 0.08)',
        },
      }),
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...markdownKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.suppressChange) {
          options.onChange(this.getContent());
        }
      }),
    ];

    const state = EditorState.create({
      doc: options.initialContent ?? '',
      extensions,
    });

    this.view = new EditorView({
      state,
      parent: host,
    });
  }

  public setContent(content: string): void {
    if (content === this.getContent()) {
      return;
    }

    this.suppressChange = true;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
    });
    this.suppressChange = false;
  }

  public getContent(): string {
    return this.view.state.doc.toString();
  }

  public focus(): void {
    this.view.focus();
  }

  public getScrollElement(): HTMLElement {
    return this.view.scrollDOM;
  }

  public setScrollTop(scrollTop: number): void {
    this.view.scrollDOM.scrollTop = scrollTop;
  }

  public insertMarkdown(tool: string): void {
    const selection = this.view.state.selection.main;
    const selectedText = this.view.state.doc.sliceString(selection.from, selection.to);
    let insert = '';
    let cursorOffset = 0;

    switch (tool) {
      case 'h1':
        insert = `# ${selectedText || 'Heading 1'}`;
        cursorOffset = selectedText ? 0 : -insert.length + 2;
        break;
      case 'h2':
        insert = `## ${selectedText || 'Heading 2'}`;
        cursorOffset = selectedText ? 0 : -insert.length + 3;
        break;
      case 'h3':
        insert = `### ${selectedText || 'Heading 3'}`;
        cursorOffset = selectedText ? 0 : -insert.length + 4;
        break;
      case 'bold':
        insert = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? 0 : -11;
        break;
      case 'italic':
        insert = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? 0 : -12;
        break;
      case 'underline':
        insert = `<u>${selectedText || 'underlined text'}</u>`;
        cursorOffset = selectedText ? 0 : -20;
        break;
      case 'quote':
        insert = `> ${selectedText || 'quote'}`;
        cursorOffset = selectedText ? 0 : -5;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          insert = `\`\`\`\n${selectedText}\n\`\`\``;
          cursorOffset = 0;
        } else {
          insert = `\`${selectedText || 'code'}\``;
          cursorOffset = selectedText ? 0 : -5;
        }
        break;
      case 'ul':
        insert = `- ${selectedText || 'List item'}`;
        cursorOffset = selectedText ? 0 : -9;
        break;
      case 'ol':
        insert = `1. ${selectedText || 'List item'}`;
        cursorOffset = selectedText ? 0 : -9;
        break;
      case 'link':
        insert = `[${selectedText || 'link text'}](url)`;
        cursorOffset = selectedText ? -4 : -14;
        break;
      case 'image':
        insert = `![${selectedText || 'alt text'}](url)`;
        cursorOffset = selectedText ? -4 : -14;
        break;
      default:
        return;
    }

    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: selection.from + insert.length + cursorOffset },
    });

    this.view.focus();
  }

  public destroy(): void {
    this.view.destroy();
  }
}
