# LucidMark

LucidMark is a powerful, modern cross-platform markdown viewer and editor built with Tauri (Rust backend) and TypeScript (Vanilla DOM frontend). Designed for clarity and simplicity, LucidMark provides a seamless writing and reading experience with multi-tab support, live preview, and rich rendering capabilities.

## Key Features
- **Multi-Tab Editing**: Work on multiple documents simultaneously with independent tab states
- **Live Preview**: Dual-pane editor with synchronized scrolling and real-time rendering
- **GitHub-Flavored Markdown**: Full GFM support including task lists, tables, strikethrough, emoji, and footnotes
- **Rich Content Rendering**:
  - Syntax highlighting for 40+ programming languages (Prism)
  - Math equations with LaTeX (KaTeX)
  - Diagrams with Mermaid and DrawIO
- **Quick Formatting Toolbar**: One-click access to common markdown formatting
- **Smart Editor**: CodeMirror-powered editor with markdown syntax highlighting
- **Customizable Preview**: Toggle rendering features (math, diagrams, syntax highlighting)
- **Session Persistence**: Settings, recent files, and UI state saved between sessions

This repository follows the guidelines in `AGENTS.md` and the implementation playbooks under `LucidMark-Instructions/`.

## Prerequisites
- Node.js 20+
- Rust stable toolchain (`rustup` recommended)
- Tauri CLI (`npm install -g @tauri-apps/cli`) and platform-specific build deps from [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

## Setup
```bash
npm install
```

## Development
```bash
# Vite dev server inside the Tauri shell
npm run tauri:dev

# Frontend-only hot reload (no desktop shell)
npm run dev
```

## Quality Gates
```bash
npm run lint        # ESLint with TypeScript rules
npm run type-check  # TypeScript project check
npm run test:run    # Vitest (jsdom) test suite
npm run format      # Prettier formatting for TS/CSS/markdown
```

## Building Distributables
```bash
npm run tauri:build
```

For detailed architecture, coding standards, and multi-agent workflows, see `LucidMarkDesktop-Instructions/` and `docs/`.
