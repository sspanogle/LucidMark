import katex from 'katex';

type MarkdownItPlugin = (md: any) => void;

type MathToken = {
  content: string;
  markup: string;
  block?: boolean;
  info?: string;
  map?: [number, number];
};

type InlineRule = (state: any, silent: boolean) => boolean;
type BlockRule = (state: any, startLine: number, endLine: number, silent: boolean) => boolean;

function isEscaped(source: string, pos: number): boolean {
  let slashCount = 0;
  for (let i = pos - 1; i >= 0 && source[i] === '\\'; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function createInlineRule(): InlineRule {
  return (state: any, silent: boolean) => {
    const start = state.pos;
    const marker = state.src.charCodeAt(start);

    if (marker !== 0x24 /* $ */) {
      return false;
    }

    let next = start + 1;

    while ((next = state.src.indexOf('$', next)) !== -1) {
      if (next === start + 1) {
        next += 1;
        continue;
      }

      if (isEscaped(state.src, next)) {
        next += 1;
        continue;
      }

      const content = state.src.slice(start + 1, next);
      if (content.trim().length === 0) {
        return false;
      }

      if (!silent) {
        const token = state.push('math_inline', 'math', 0) as MathToken;
        token.markup = '$';
        token.content = content;
      }

      state.pos = next + 1;
      return true;
    }

    if (!silent) {
      state.pos = start;
    }
    return false;
  };
}

function createBlockRule(): BlockRule {
  return (state: any, startLine: number, endLine: number, silent: boolean) => {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') {
      return false;
    }

    pos += 2;
    let currentLine = startLine;
    let content = '';
    let closeLine = startLine;
    let line = state.src.slice(pos, max);

    if (line.trim().endsWith('$$')) {
      line = line.replace(/\$\$\s*$/, '');
      content = line.trim();
      closeLine = startLine;
    } else {
      const lines: string[] = [];
      if (line.trim().length > 0) {
        lines.push(line);
      }

      let found = false;
      while (++currentLine < endLine) {
        pos = state.bMarks[currentLine] + state.tShift[currentLine];
        const lineMax = state.eMarks[currentLine];
        const lineText = state.src.slice(pos, lineMax);

        if (lineText.trim().endsWith('$$') && !lineText.trim().endsWith('\\$$')) {
          found = true;
          lines.push(lineText.replace(/\$\$\s*$/, ''));
          closeLine = currentLine;
          break;
        }

        lines.push(lineText);
      }

      if (!found) {
        return false;
      }

      content = lines.join('\n').trim();
    }

    if (!silent) {
      state.line = closeLine + 1;
      const token = state.push('math_block', 'math', 0) as MathToken;
      token.block = true;
      token.content = content;
      token.info = 'math block';
      token.markup = '$$';
      token.map = [startLine, state.line];
    }

    return true;
  };
}

export interface MarkdownItKatexOptions {
  throwOnError?: boolean;
  errorColor?: string;
  macros?: Record<string, string>;
  onError?: (message: string) => void;
}

export function markdownItKatex(options: MarkdownItKatexOptions = {}): MarkdownItPlugin {
  const resolvedOptions: MarkdownItKatexOptions = { throwOnError: true, ...options };
  const report = (message: string): void => {
    options.onError?.(message);
  };
  const { onError: _ignored, ...katexOptions } = resolvedOptions;

  return (md: any) => {
    md.inline.ruler.after('escape', 'math_inline', createInlineRule());
    md.block.ruler.after('blockquote', 'math_block', createBlockRule(), {
      alt: ['paragraph', 'reference', 'blockquote', 'list'],
    });

    const inlineRenderer = (tokens: any[], idx: number): string => {
      const token = tokens[idx] as MathToken;
      try {
        return katex.renderToString(token.content, {
          displayMode: false,
          ...katexOptions,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        report(`KaTeX inline formula failed: ${reason}`);
        return token.content;
      }
    };

    const blockRenderer = (tokens: any[], idx: number): string => {
      const token = tokens[idx] as MathToken;
      try {
        const rendered = katex.renderToString(token.content, {
          displayMode: true,
          ...katexOptions,
        });
        return `<div class="math-block">${rendered}</div>`;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        report(`KaTeX block formula failed: ${reason}`);
        return `<pre class="math-block">${md.utils.escapeHtml(token.content)}</pre>`;
      }
    };

    md.renderer.rules.math_inline = inlineRenderer;
    md.renderer.rules.math_block = blockRenderer;
  };
}
