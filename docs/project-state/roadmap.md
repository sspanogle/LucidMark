# Roadmap

## Purpose
Describe the likely next implementation sequence for LucidMark.

This is not a release promise. It exists to keep future work ordered against the current codebase.

---

## Current Phase

Stabilization and documentation alignment.

Current project state:
- the core desktop editing flow is working
- recent file, export, and navigation features are in place
- the open-file dialog path now has explicit permission and error handling
- remaining work is mostly polish, validation, and deeper export/session improvements

---

## Milestone Plan

### Milestone 1: Core Workflow Hardening
Goals:
- verify open/save/recents behavior in the desktop shell
- keep dialog and permission handling explicit
- reduce silent failure paths

Status:
- in progress

### Milestone 2: Session and Tab Continuity
Goals:
- persist tab state across app restarts
- clarify how opening files should behave when tabs already exist
- add keyboard shortcuts for common tab actions

Status:
- planned

### Milestone 3: Export Quality
Goals:
- improve Word export fidelity
- make PDF output more usable for long documents
- add export options and progress feedback

Status:
- planned

### Milestone 4: UI and UX Polish
Goals:
- refine navigation and toolbar ergonomics
- improve dense layout handling
- tighten copy, labels, and documentation

Status:
- planned

### Milestone 5: Testing and Coverage
Goals:
- add focused unit tests for file and export helpers
- expand browser and Tauri flow verification
- keep regressions from reaching the desktop shell

Status:
- planned
