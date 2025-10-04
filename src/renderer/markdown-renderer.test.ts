import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { MarkdownRenderer } from '@renderer/markdown-renderer';

const renderer = new MarkdownRenderer();

describe('MarkdownRenderer', () => {
  it('renders markdown to sanitized HTML', () => {
    const input = '# Title\n\n<script>alert("xss")</script>\n\n**bold**';
    const { html, raw } = renderer.render(input);

    expect(raw).toContain('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('honors linkify option', () => {
    const customRenderer = new MarkdownRenderer({ enableLinkify: false });
    const { html } = customRenderer.render('Visit https://example.com');

    expect(html).toContain('https://example.com');
    expect(html).not.toContain('<a');
  });

  it('renders GFM tables', () => {
    const markdown = ['| Name | Value |', '| --- | --- |', '| Foo | 123 |'].join('\n');
    const { html } = renderer.render(markdown);
    const dom = new JSDOM(html);
    const table = dom.window.document.querySelector('table');

    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('thead th').length).toBeGreaterThan(0);
    expect(table?.textContent).toContain('Foo');
  });

  it('renders task lists with checkboxes intact', () => {
    const markdown = ['- [x] Done item', '- [ ] Pending item'].join('\n');
    const { html } = renderer.render(markdown);
    const dom = new JSDOM(html);
    const inputs = Array.from(
      dom.window.document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );

    expect(inputs).toHaveLength(2);
    expect(inputs.every((input) => input.disabled)).toBe(true);
    expect(inputs.some((input) => input.checked)).toBe(true);
    expect(inputs.some((input) => !input.checked)).toBe(true);
  });

  it('renders strikethrough text', () => {
    const { html } = renderer.render('This is ~~struck~~ text');
    const dom = new JSDOM(html);
    const strike = dom.window.document.querySelector('s, del');

    expect(strike?.textContent).toBe('struck');
  });

  it('renders inline math with KaTeX', () => {
    const { html } = renderer.render('Inline math $a^2 + b^2 = c^2$ example');
    const dom = new JSDOM(html);
    const math = dom.window.document.querySelector('.katex');

    expect(math).not.toBeNull();
    expect(math?.textContent?.replace(/\s+/g, ' ').trim()).toContain('a^2 + b^2 = c^2');
  });

  it('renders block math with KaTeX display output', () => {
    const { html } = renderer.render('$$\\int_0^1 x^2 \\mathrm{d}x$$');
    const dom = new JSDOM(html);
    const block = dom.window.document.querySelector('.math-block .katex-display');

    expect(block).not.toBeNull();
  });

  it('can disable math rendering via options', () => {
    const noMathRenderer = new MarkdownRenderer({ enableMath: false });
    const { html } = noMathRenderer.render('Inline math $x + y$ stays literal');

    expect(html).toContain('$x + y$');
    expect(html).not.toContain('katex');
  });

  it('updates math rendering when toggled at runtime', () => {
    const dynamicRenderer = new MarkdownRenderer({ enableMath: false });

    expect(dynamicRenderer.render('$z$').html).not.toContain('katex');

    dynamicRenderer.setMathEnabled(true);

    expect(dynamicRenderer.render('$z$').html).toContain('katex');
  });

  it('collects warnings when KaTeX fails to render', () => {
    const { warnings } = renderer.render('Inline math $\\notacommand$ test');

    expect(warnings).toBeDefined();
    expect(warnings?.some((message) => message.toLowerCase().includes('katex'))).toBe(true);
  });
});
