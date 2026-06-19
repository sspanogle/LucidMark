import mermaid from 'mermaid';
import Prism from 'prismjs';
import { copyToClipboard, showCopyFeedback } from '@utils/clipboard';
import '@renderer/prism-languages';

type Nullable<T> = T | null | undefined;

interface DrawioParseResult {
  readonly type: 'svg' | 'xml';
  readonly content: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
});

interface PrismStatic {
  highlightAllUnder: (element: ParentNode) => void;
}

const prism = Prism as unknown as PrismStatic;

export interface EnhanceMarkdownOptions {
  readonly enableSyntaxHighlighting?: boolean;
  readonly enableDiagrams?: boolean;
  readonly onWarning?: (message: string) => void;
}

function addCopyButtonsToCodeBlocks(container: HTMLElement): void {
  // Find all pre > code elements (code blocks, not inline code)
  const codeBlocks = Array.from(container.querySelectorAll<HTMLPreElement>('pre > code'));

  codeBlocks.forEach((codeEl) => {
    const pre = codeEl.parentElement;
    if (!pre || pre.classList.contains('code-block-container')) {
      return; // Skip if already processed or no parent
    }

    // Get the text content to copy
    const textToCopy = codeEl.textContent ?? '';
    if (textToCopy.trim().length === 0) {
      return; // Skip empty code blocks
    }

    // Wrap the pre element in a container for positioning
    pre.classList.add('code-block-container');

    // Create the copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-block-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.type = 'button';
    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');

    // Add click handler
    copyBtn.addEventListener('click', (event) => {
      event.preventDefault();
      void (async (): Promise<void> => {
        const result = await copyToClipboard(textToCopy);
        
        // Temporarily update button text
        const originalText = copyBtn.textContent;
        copyBtn.textContent = result.success ? 'Copied!' : 'Failed';
        
        // Show feedback tooltip
        showCopyFeedback(copyBtn, result.message, result.success);
        
        // Restore button text after a delay
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1000);
      })();
    });

    // Append button to the pre element
    pre.appendChild(copyBtn);
  });
}

export async function enhanceMarkdown(
  container: HTMLElement,
  options: EnhanceMarkdownOptions = {},
): Promise<void> {
  const {
    enableSyntaxHighlighting = true,
    enableDiagrams = true,
    onWarning,
  } = options;

  if (enableSyntaxHighlighting) {
    prism.highlightAllUnder(container);
  }

  addCopyButtonsToCodeBlocks(container);

  if (!enableDiagrams) {
    return;
  }

  renderDrawioPlaceholders(container, onWarning);
  convertMermaidPlaceholders(container);
  try {
    await mermaid.run({ nodes: container.querySelectorAll('.mermaid-diagram') });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    onWarning?.(`Mermaid diagram failed to render: ${reason}`);
  }
  renderDrawio(container, onWarning);
}

function convertMermaidPlaceholders(container: HTMLElement): void {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('code.language-mermaid'));

  blocks.forEach((codeEl) => {
    const pre = codeEl.closest('pre');
    const diagramCode = codeEl.textContent ?? '';

    if (!pre || diagramCode.trim().length === 0) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-container mermaid-diagram';
    wrapper.textContent = diagramCode;

    pre.replaceWith(wrapper);
  });
}

function renderDrawioPlaceholders(container: HTMLElement, onWarning?: (message: string) => void): void {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('code.language-drawio'));

  blocks.forEach((codeEl) => {
    const pre = codeEl.closest('pre');
    const raw = codeEl.textContent?.trim();

    if (!pre || !raw) {
      return;
    }

    const parsed = parseDrawioContent(raw);
    if (!parsed) {
      onWarning?.('Unable to parse draw.io diagram.');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-container drawio-diagram';

    pre.replaceWith(wrapper);
    wrapper.dataset.diagramRaw = parsed.content;
    wrapper.dataset.diagramType = parsed.type;
  });
}

function renderDrawio(container: HTMLElement, onWarning?: (message: string) => void): void {
  const diagramContainers = Array.from(
    container.querySelectorAll<HTMLElement>('.drawio-diagram'),
  );

  diagramContainers.forEach((wrapper) => {
    const type = wrapper.dataset.diagramType;
    const rawContent = wrapper.dataset.diagramRaw;
    if (!type || !rawContent) {
      return;
    }

    if (type === 'svg') {
      const svgElement = parseSvg(rawContent);
      if (svgElement) {
        wrapper.innerHTML = '';
        wrapper.appendChild(svgElement);
      } else {
        onWarning?.('Unable to render draw.io SVG diagram.');
      }
      delete wrapper.dataset.diagramRaw;
      delete wrapper.dataset.diagramType;
      return;
    }

    if (type === 'xml') {
      const iframe = document.createElement('iframe');
      iframe.className = 'drawio-viewer-frame';
      iframe.setAttribute('title', 'draw.io diagram preview');
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

      const encoded = encodeURIComponent(rawContent);
      iframe.src = `https://viewer.diagrams.net/?lightbox=1&highlight=0000ff&edit=_blank&layers=1&nav=1&title=diagram#R${encoded}`;
      wrapper.innerHTML = '';
      wrapper.appendChild(iframe);
      delete wrapper.dataset.diagramRaw;
      delete wrapper.dataset.diagramType;
      return;
    }

    onWarning?.('Unsupported draw.io diagram type.');
  });
}

function parseDrawioContent(raw: string): Nullable<DrawioParseResult> {
  // If the content already looks like XML/SVG markup, return directly.
  if (raw.startsWith('<svg') || raw.startsWith('<mxfile') || raw.startsWith('<?xml')) {
    return raw.startsWith('<svg')
      ? { type: 'svg', content: raw }
      : { type: 'xml', content: raw };
  }

  // Attempt to treat the content as Base64-encoded data.
  try {
    const decoded = atob(raw.replace(/\s+/g, ''));
    if (decoded.startsWith('<svg')) {
      return { type: 'svg', content: decoded };
    }
    if (decoded.startsWith('<mxfile')) {
      return { type: 'xml', content: decoded };
    }
  } catch (error) {
    console.error('Failed to decode draw.io diagram content', error);
  }

  return null;
}

function parseSvg(content: string): Nullable<SVGSVGElement> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const svg = doc.documentElement;

    if (svg instanceof SVGSVGElement) {
      sanitizeSvg(svg);
      const cloned = svg.cloneNode(true);
      if (cloned instanceof SVGSVGElement) {
        return cloned;
      }
    }
  } catch (error) {
    console.error('Failed to parse draw.io SVG content', error);
  }

  return null;
}

function sanitizeSvg(svg: SVGSVGElement): void {
  const forbiddenTags = ['script', 'foreignObject'];
  forbiddenTags.forEach((tag) => {
    const nodes = svg.querySelectorAll(tag);
    nodes.forEach((node) => node.remove());
  });

  svg.removeAttribute('onload');
}
