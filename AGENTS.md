# Repository Guidelines

## Project Structure & Architecture

This repository contains a React 18, TypeScript, Vite, and styled-components frontend plus a Java 21 / Spring Boot backend reference implementation. Read `docs/HANDOFF.md` for the accepted decisions, current implementation, verification results, and outstanding work before continuing development.

`src/main.tsx` mounts `App`. The shell consists of `Header`, `Sidenav`, and `Topbar`; module definitions live in `src/config/moduleConfig.ts`. Hash-based navigation selects Project Manager, Wiki, or Dev Tools. Module components remain mounted during navigation to retain session state; authentication changes reset account-scoped state.

Project management lives under `src/pages/projects/`:

- `components/` contains the dashboard, project details, forms, tabs, and badges.
- `tabs/tasks/` contains task list and Kanban views; drag-and-drop uses `@dnd-kit/core`.
- Feature hooks own forms and CRUD behavior. Persisted domain collections are accessed through `useWorkspaceField` in `src/hooks/workspaceContext.ts`, not separate seeded state in each hook.
- `types/` defines project, customer, task, activity, and tab types.
- `styles/` contains feature-level styled-components.

Wiki lives under `src/pages/wiki/`; JSON Formatter, REST client, calculator, and converters live under `src/pages/devTools/`. Shared dialogs and form controls are in `src/components/ui/`. Seed data is in `src/data/`; static assets belong in `public/` or `src/assets/`.

`src/services/api/`, `auth/`, `workspace/`, and `settings/` implement the HTTP client, authentication lifecycle, workspace synchronization, and account settings. `VITE_DATA_MODE=local` (default) uses session-only example data without backend requests. `VITE_DATA_MODE=api` requires a verified backend session; it must not silently fall back to examples after an error. API configuration is documented in `.env.example` and `docs/backend-api.md`.

`backend/` is a separate Maven project using Spring Boot 4.1.1 and Spring Security. Password verification uses server-side BCrypt; sessions use HttpOnly cookies, CSRF protection, and origin validation. Data access is abstracted by `Accounts` and `WorkspaceStorage`. The reference adapters keep data and attachments in memory; there is no database or durable storage yet. `docs/openapi.json` defines the API contract. Workspace updates are atomic multipart `PUT /api/v1/workspace` transactions with revision / If-Match conflict detection, not separate CRUD endpoints for every entity.

The ticket system is explicitly postponed at the user's request. Database technology and production deployment remain undecided. Preserve the existing frontend and API contracts when replacing storage adapters.

## Development Commands

- `npm install` installs the exact versions recorded in `package-lock.json`.
- `npm run dev` starts Vite with hot reload.
- `npm run lint` runs ESLint, including TypeScript, React Hooks, and Fast Refresh rules.
- `npm test` runs the frontend/domain/API tests using `scripts/test.mjs` and Node's test runner.
- `npm run build` performs strict TypeScript checks, then creates `dist/`.
- `npm run preview` serves the production build locally.
- `mvn -f backend/pom.xml test` compiles and tests the Java backend (Java 21 / Maven 3.9).
- `mvn -f backend/pom.xml spring-boot:run` starts the backend after configuring its environment; see `backend/README.md`. From the `backend/` directory, omit `-f backend/pom.xml`.

Run lint and build before submitting code changes; run the relevant frontend and/or Spring tests for behavior changes. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. `scripts/verify-backend.ps1` can download checksummed Java/Maven tools into `node_modules/.tmp/backend-tools` and run Spring tests without a system installation; it requires network access on first use. Keep downloaded tools and build artifacts out of version control.

## Coding Conventions

Feature code predominantly uses four-space indentation, single quotes, semicolons, PascalCase component files, camelCase values, and `useX` hook names. Keep feature-only code co-located; promote it to shared folders only after reuse emerges. Use typed props and domain types, immutable state updates, styled-components with theme tokens, and transient `$prop` names for styling-only props. Avoid `any`; TypeScript strict mode and unused-symbol checks are enabled. Preserve UTF-8 text because the UI contains German labels and symbols.

Java uses four-space indentation, typed DTO records and interfaces, Jakarta validation, and Spring Security. Keep passwords and password hashes out of frontend code and API responses. Never put real credentials into source, fixtures, documentation, or logs. Backend startup requires configured account values; there is no built-in application password. Existing test credentials are test-only.

## Testing & Change Guidelines

Frontend tests use `*.test.ts` next to the tested unit; register new suites/dependencies in `scripts/test.mjs`. Spring integration tests live in `backend/src/test/`. Manual browser checks are documented in `README.md`; distinguish them from automated tests, and do not claim visual verification unless a browser was actually available.

Git history was unavailable during the initial work; inspect the current checkout before assuming Git capabilities. Use focused commits with imperative subjects, for example `Fix task status updates`. Pull requests should describe behavior and verification, link issues, and include screenshots for UI changes. Do not describe the in-memory reference backend as a database integration or durable persistence.
