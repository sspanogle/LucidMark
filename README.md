# LucidMark

A powerful, modern cross-platform markdown viewer and editor built with Tauri and TypeScript. Designed for clarity and simplicity, LucidMark provides a seamless writing and reading experience with professional-grade rendering capabilities.

![LucidMark](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## Overview

LucidMark combines the power of a Rust backend (Tauri) with a responsive TypeScript frontend to deliver a fast, native desktop markdown experience. Whether you're writing documentation, taking notes, or authoring technical content, LucidMark provides the tools you need without the bloat.

## ✨ Features

### 📝 Multi-Tab Document Editing
- **Work on multiple documents simultaneously** with independent tab states
- Each tab maintains its own content, cursor position, and edit state
- **Smart tab management**: Create, switch, and close tabs with unsaved changes warnings
- Responsive tab bar with horizontal scrolling for many open documents
- Visual indication of active tab with seamless content integration

### 🔄 Live Dual-Pane Preview
- **Split-screen editor and preview** with synchronized scrolling
- Real-time markdown rendering as you type
- **View/Edit toggle** for focused writing or reading modes
- Adjustable split pane - drag to resize editor and preview panels
- Preview updates instantly with every keystroke

### 🎨 Rich Markdown Rendering
LucidMark supports GitHub-Flavored Markdown (GFM) and extended features:

#### Core Markdown
- **Headings** (H1-H6) with automatic anchor links
- **Emphasis**: Bold, italic, strikethrough, underline
- **Lists**: Ordered, unordered, and nested
- **Task lists** with interactive checkboxes
- **Tables** with multi-markdown table support (colspan, rowspan)
- **Blockquotes** with nested support
- **Code blocks** with language specification
- **Inline code** with syntax highlighting
- **Links** (standard, reference-style, autolinks)
- **Images** with alt text and titles
- **Horizontal rules**
- **Footnotes** with automatic numbering
- **Emoji** support :rocket:

#### Advanced Features
- **Syntax Highlighting**: 40+ programming languages powered by Prism.js
  - JavaScript, TypeScript, Python, Rust, Go, Java, C++, PHP, Ruby, and more
  - Line numbers and language badges
  - Copy code button integration

- **Math Equations**: LaTeX rendering with KaTeX
  - Inline math: `$E = mc^2$`
  - Display math: `$$\int_{a}^{b} f(x) dx$$`
  - Full LaTeX syntax support

- **Diagrams & Visualizations**:
  - **Mermaid**: Flowcharts, sequence diagrams, Gantt charts, class diagrams
  - **DrawIO**: Embedded diagram support
  - Auto-rendering with error handling

### 🛠️ Quick Formatting Toolbar
One-click access to common markdown formatting:
- Heading levels (H1, H2, H3)
- Text formatting (Bold, Italic, Underline)
- Lists (Unordered, Ordered)
- Blockquotes
- Code blocks
- Links and images
- Smart text wrapping for selections

### 💾 Document Management

#### File Operations
- **Open files** via dialog, recent documents, or drag-and-drop
- **Save and Save As** with automatic markdown extension
- **Auto-save** with configurable intervals
- **Recent documents gallery** with responsive card grid
- Quick access to recently opened files on launch

#### Export Capabilities
- **Export to PDF**: High-quality PDF generation with multi-page support
- **Export to Word**: DOCX format for compatibility
- **Smart export paths**: Automatically saves to same directory as source file
- **One-click export**: Exports maintain original filename with new extension

#### File System Integration
- **Open file location**: Reveal current file in system explorer/finder
- **Path-aware**: Full file path display with smart truncation
- **Native dialogs**: System-native file picker integration

### ⚙️ Customizable Preview Settings
Toggle rendering features to match your needs:
- **Math rendering** (KaTeX) - Enable/disable LaTeX equations
- **Diagram rendering** (Mermaid/DrawIO) - Toggle diagram visualization
- **Syntax highlighting** (Prism) - Control code block styling
- Settings persist across sessions

### 🎯 Smart Editor
Powered by CodeMirror 6:
- **Markdown syntax highlighting** in the editor
- **Line numbers** and line wrapping
- **Search and replace** functionality
- **Keyboard shortcuts** for common operations
- **Undo/Redo** with full history
- **Auto-closing brackets** and quotes
- **Multi-cursor support**

### 💼 Session Management
- **Persistent settings**: All preferences saved between sessions
- **Recent files tracking**: Access your work history
- **UI state preservation**: Window size, split position, and view mode
- **Tab state** (in development): Restore open tabs on restart

### 🎨 User Interface

#### Modern Design
- Clean, distraction-free interface
- GitHub-inspired markdown styling
- Smooth animations and transitions
- Responsive layout for all screen sizes

#### Navigation
- **Viewer**: Main document editing interface
- **Settings**: Dedicated settings page with toggle controls
- **About**: Application information and capabilities overview
- **Collapsible sections**: Active document and recent files with persistent state

#### Status Bar
- Real-time file information (size, last modified)
- Export progress and completion messages
- Quick access to file location
- Helpful status messages and notifications

### 🔐 Security & Privacy
- **Local-first**: All data stays on your machine
- **No telemetry**: No tracking or data collection
- **Sandboxed**: Tauri security model with scoped file system access
- **Offline-capable**: Works without internet connection

### 🚀 Performance
- **Fast startup**: Native app performance with Rust backend
- **Efficient rendering**: Optimized preview updates
- **Memory efficient**: Smart resource management for large documents
- **Smooth scrolling**: 60fps interface updates

## 🖥️ Platform Support

- **macOS**: Fully tested and supported (10.13+)
- **Windows**: Supported (Windows 10+)
- **Linux**: Supported (most distributions)

## 📋 Prerequisites

- Node.js 20+
- Rust stable toolchain (`rustup` recommended)
- Platform-specific dependencies: [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lucidmark.git
cd lucidmark

# Install dependencies
npm install
```

### Development

```bash
# Run in development mode (Tauri + Vite hot reload)
npm run tauri:dev

# Frontend-only development (no desktop shell)
npm run dev
```

### Building

```bash
# Create production build
npm run tauri:build

# Distributables will be in src-tauri/target/release/bundle/
```

## 🧪 Quality Assurance

```bash
# Linting
npm run lint          # ESLint with TypeScript rules
npm run lint:fix      # Auto-fix linting issues

# Type checking
npm run type-check    # TypeScript compiler check

# Testing
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Vitest UI interface

# Formatting
npm run format        # Prettier formatting for TS/CSS/Markdown

# Build check
npm run build         # Production frontend build
```

## 📁 Project Structure

```
lucidmark/
├── src/                      # Frontend TypeScript code
│   ├── app/                  # Application bootstrap and state
│   ├── editor/               # CodeMirror editor integration
│   ├── export/               # PDF/Word export functionality
│   ├── file-system/          # File operations service
│   ├── renderer/             # Markdown rendering engine
│   ├── settings/             # Settings and preferences
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri commands (frontend API)
│   │   ├── file_ops/         # File I/O operations
│   │   ├── menu/             # Native menu integration
│   │   └── settings/         # Settings store management
│   └── capabilities/         # Tauri security permissions
├── docs/                     # Documentation
│   ├── agent-handoff-log.md # Development session log
│   └── session-*.md          # Detailed session notes
└── index.html                # Application entry point
```

## 🎯 Use Cases

### Perfect For
- **Technical Writers**: Document APIs, create tutorials, write user guides
- **Developers**: README files, code documentation, project wikis
- **Students**: Note-taking with math equations and diagrams
- **Researchers**: Academic writing with citations and footnotes
- **Content Creators**: Blog posts, articles, documentation sites
- **Teams**: Collaborative markdown editing with consistent rendering

### Why Choose LucidMark?
- **Native Performance**: Faster than Electron-based editors
- **Rich Rendering**: Professional-grade output with math and diagrams
- **Multi-Tab Workflow**: Handle multiple documents efficiently
- **Export Ready**: One-click PDF/Word export for sharing
- **Privacy Focused**: Your documents never leave your machine
- **Open Source**: Transparent, auditable, and extensible

## 🗺️ Roadmap

### Planned Features
- [ ] Tab persistence across app restarts
- [ ] Keyboard shortcuts for tab navigation
- [ ] Enhanced Word export with rich formatting
- [ ] Text-based PDF export for searchability
- [ ] Dark mode theme
- [ ] Custom CSS themes for preview
- [ ] Split view (two documents side-by-side)
- [ ] Global search across all documents
- [ ] Git integration for version control
- [ ] Vim keybindings option

### Under Consideration
- [ ] Cloud sync (optional)
- [ ] Mobile versions (iOS/Android)
- [ ] Collaborative editing
- [ ] Plugin system for extensions
- [ ] Custom export templates
- [ ] Table of contents generation

## 🤝 Contributing

Contributions are welcome! This project follows a multi-agent development workflow. Please see:
- `AGENTS.md` - Development guidelines and agent workflows
- `LucidMark-Instructions/` - Implementation playbooks
- `docs/` - Architecture and session notes

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run quality gates (`npm run lint && npm run type-check && npm run test:run`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with these excellent open-source projects:
- [Tauri](https://tauri.app/) - Desktop application framework
- [CodeMirror 6](https://codemirror.net/) - Advanced text editor
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown parser
- [Prism.js](https://prismjs.com/) - Syntax highlighting
- [KaTeX](https://katex.org/) - Math rendering
- [Mermaid](https://mermaid.js.org/) - Diagram generation
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation
- [docx](https://github.com/dolanmiu/docx) - Word document generation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/lucidmark/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/lucidmark/discussions)
- **Documentation**: See `/docs` directory

---

**Made with ❤️ using Rust and TypeScript**
