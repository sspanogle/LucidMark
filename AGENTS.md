# Repository Guidelines

## Project Structure & Module Organization
Source code lives in `src/`, grouped by feature (`app`, `editor`, `renderer`, `file-system`, `settings`, `ui`, `utils`, `types`). Desktop integrations reside in `src-tauri/src/` with commands, file operations, settings, and error modules. Shared assets belong in `public/assets/icons` and `public/assets/themes`, while docs and CI live under `docs/` and `.github/workflows/`.

## Build, Test, and Development Commands
Use `npm run tauri:dev` for the Tauri development shell and `npm run build` for the typed frontend bundle. Run `npm run tauri:build` when producing installers. Quality checks cover `npm run lint`, `npm run type-check`, and `npm run format`. Execute `npm test` for Vitest and `cd src-tauri && cargo check` (or `cargo test`) for the Rust backend.

## Coding Style & Naming Conventions
Adopt two-space indentation, single quotes, trailing commas, and explicit return types in TypeScript. Prefer named exports and keep imports ordered: external packages, Tauri APIs, then internal alias paths (e.g., `@editor/markdown`). Enforce ESLint + Prettier via `npm run lint:fix` and `npm run format`. Rust code is formatted with `rustfmt`, uses snake_case functions, PascalCase structs/enums, and descriptive error types; keep asynchronous operations wrapped in safe helpers with typed results.

## Testing Guidelines
Vitest with the jsdom environment powers frontend unit and integration tests; mirror file names with `.test.ts` suffixes next to the code under test. Cover HTML sanitization, markdown rendering, and Tauri invoke flows. Backend tests rely on Tokio’s async harness and TempDir utilities—ensure path validation, file writing, and backup behavior stay deterministic. Maintain >90% coverage when shipping new features.

## Commit & Pull Request Guidelines
Draft commit messages as an imperative summary line, then a blank line, then concise bullet points (see the initial setup commit for format). Scope each commit to a cohesive change set. Pull requests must describe the problem, the solution, affected modules, and how to verify (commands run, screenshots for UI). Link roadmap issues when applicable and wait for automated lint/test jobs to pass before requesting review.

## Security & Configuration Tips
Sanitize all rendered markdown through DOMPurify before updating the preview, and never inject unsanitized HTML. Validate each filesystem path on the TypeScript and Rust sides, rejecting traversal and oversize payloads. Keep `vite.config.ts` and `tsconfig.json` alias maps in sync, and rerun `cargo clean` plus `npm run clean` when artifacts drift.
