import MarkdownIt from 'markdown-it';
import type { PluginSimple, PluginWithOptions } from 'markdown-it';
import anchor from 'markdown-it-anchor';
import container from 'markdown-it-container';
import emoji from 'markdown-it-emoji';
import footnote from 'markdown-it-footnote';
import multiMdTable from 'markdown-it-multimd-table';
import taskLists from 'markdown-it-task-lists';
import { markdownItKatex } from '@renderer/plugins/markdown-it-katex';

import type { RenderResult } from '@shared-types/renderer';
import { sanitizeHtml } from '@renderer/sanitizer';

export interface MarkdownRendererOptions {
  readonly enableLinkify?: boolean;
  readonly enableTypographer?: boolean;
  readonly enableMath?: boolean;
  readonly onWarning?: (message: string) => void;
}

interface ResolvedMarkdownRendererOptions {
  readonly enableLinkify: boolean;
  readonly enableTypographer: boolean;
  readonly enableMath: boolean;
  readonly onWarning?: (message: string) => void;
}

export class MarkdownRenderer {
  private parser: MarkdownIt;
  private options: ResolvedMarkdownRendererOptions;
  private warnings: string[] = [];

  public constructor(options: MarkdownRendererOptions = {}) {
    this.options = {
      enableLinkify: true,
      enableTypographer: true,
      enableMath: true,
      ...options,
    };

    this.parser = this.createParser();
  }

  private createParser(): MarkdownIt {
    const parser = new MarkdownIt({
      html: true,
      linkify: this.options.enableLinkify,
      typographer: this.options.enableTypographer,
      breaks: false,
    });
    const reportWarning = (message: string): void => {
      this.warnings.push(message);
      this.options.onWarning?.(message);
    };

    parser
      .use(anchor, {
        slugify: (str) =>
          str
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-'),
      })
      .use(emoji as unknown as PluginSimple)
      .use(footnote as unknown as PluginSimple)
      .use(taskLists as unknown as PluginWithOptions<{ label: boolean; labelAfter: boolean }>, {
        label: true,
        labelAfter: true,
      })
      .use(multiMdTable as unknown as PluginSimple, {
        enableMultilineRows: true,
        enableRowspan: true,
      })
      .use(container as unknown as PluginWithOptions<string>, 'info')
      .use(container as unknown as PluginWithOptions<string>, 'warning')
      .use(container as unknown as PluginWithOptions<string>, 'success');

    if (this.options.enableMath) {
      parser.use(
        markdownItKatex({
          onError: (message) => {
            reportWarning(message);
          },
        }),
      );
    }

    const fence = parser.renderer.rules.fence?.bind(parser.renderer.rules);

    parser.renderer.rules.fence = (tokens, idx, options, env, self): string => {
      const token = tokens[idx];
      const info = (token.info || '').trim().toLowerCase();

      if (info === 'mermaid') {
        const escaped = parser.utils.escapeHtml(token.content);
        return `<pre class="diagram-block"><code class="language-mermaid">${escaped}</code></pre>`;
      }

      if (info === 'drawio' || info === 'diagram') {
        const escaped = parser.utils.escapeHtml(token.content);
        return `<pre class="diagram-block"><code class="language-drawio">${escaped}</code></pre>`;
      }

      if (fence) {
        return fence(tokens, idx, options, env, self);
      }

      return self.renderToken(tokens, idx, options);
    };

    return parser;
  }

  public setMathEnabled(enable: boolean): void {
    if (this.options.enableMath === enable) {
      return;
    }

    this.options = { ...this.options, enableMath: enable };
    this.parser = this.createParser();
  }

  public render(markdown: string): RenderResult {
    this.warnings = [];

    const rawHtml = this.parser.render(markdown);
    const sanitizedHtml = sanitizeHtml(rawHtml);

    const result: RenderResult = {
      html: sanitizedHtml,
      raw: rawHtml,
    };

    if (this.warnings.length > 0) {
      (result as { warnings: string[] }).warnings = [...this.warnings];
    }

    return result;
  }
}
