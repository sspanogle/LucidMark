# Implementation Status

## Purpose
Track how the current LucidMark codebase maps to product intent and technical direction.

This document is the working status layer between:
- product intent in `docs/product/prd/`
- technical guardrails in `docs/engineering/tdd/`
- actual implemented code in the repository

Update this document when meaningful implementation milestones land.

---

## Current Summary

LucidMark is currently a Tauri desktop markdown editor/viewer with:
- multi-tab document handling
- live markdown preview and edit mode
- recent documents and native file open/save dialogs
- export to PDF and Word
- settings and about views
- file location reveal for saved documents

Recent status change:
- desktop file picker permissions are now granted through the Tauri capability file
- the open-file flow now reports errors instead of failing silently

---

## Current Implementation Areas

### Document Workflow
Implemented:
- open Markdown files from dialog, recents, and drag/drop
- create, switch, and close tabs
- edit and save documents with dirty-state tracking
- persist recent files and session preferences

Not yet implemented:
- tab persistence across full app restarts
- keyboard shortcuts for tab navigation
- more explicit open-file behavior rules when a file is already active

### Rendering and Preview
Implemented:
- live preview rendering
- preview preference toggles for math, diagrams, and syntax highlighting
- editor/preview view switching

Not yet implemented:
- searchable text-based PDF export
- richer export formatting for Word output

### File and Export Operations
Implemented:
- open and save dialogs through Tauri
- open file location on desktop
- PDF and Word export
- export path resolution from the current document path

Not yet implemented:
- export options dialog
- export progress feedback
- richer export templates and batch export

### Navigation and App Shell
Implemented:
- Viewer, Settings, and About top-level views
- recent documents screen
- quick formatting toolbar

Not yet implemented:
- keyboard shortcut documentation surfaced in-app
- tab overflow management improvements

---

## Notes

- `docs/agent-handoff-log.md` remains the historical session log.
- This directory is the framework-aligned place for current project state.
