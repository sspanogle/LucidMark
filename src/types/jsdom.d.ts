declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string | Buffer, options?: unknown);
    window: Window & typeof globalThis;
  }
}
