# Repository Guidelines

## Project Structure & Architecture

This is a client-only React 18, TypeScript, and Vite application. `src/main.tsx` mounts `App`, which installs the styled-components theme and renders `MainLayout`. The shell consists of `Header`, `Sidenav`, and `Topbar`; module definitions live in `src/config/moduleConfig.ts`. Module selection currently changes navigation labels only—`ProjectsPage` is always rendered.

The implemented feature is project management under `src/pages/projects/`:

- `components/` contains the dashboard, project details, forms, tabs, and badges.
- `tabs/tasks/` contains task list and Kanban views; drag-and-drop uses `@dnd-kit/core`.
- `hooks/useProjects.ts` and `tabs/tasks/hooks/useTasks.ts` own all mutable UI state and CRUD behavior.
- `types/` defines project, customer, task, activity, and tab types.
- `styles/` contains feature-level styled-components.

Seed data is in `src/data/`; reusable status logic is in `src/utils/`. There is no backend, API client, persistence, authentication, or working route layer. Tickets, epics, sprints, files, and settings are placeholders. Static assets belong in `public/` or `src/assets/`.

## Development Commands

- `npm install` installs the exact versions recorded in `package-lock.json`.
- `npm run dev` starts Vite with hot reload.
- `npm run lint` runs ESLint, including TypeScript, React Hooks, and Fast Refresh rules.
- `npm run build` performs strict TypeScript checks, then creates `dist/`.
- `npm run preview` serves the production build locally.

Run lint and build before submitting changes. Node/npm must be available on `PATH`.

## Coding Conventions

Feature code predominantly uses four-space indentation, single quotes, semicolons, PascalCase component files, camelCase values, and `useX` hook names. Keep feature-only code co-located; promote it to shared folders only after reuse emerges. Use typed props and domain types, immutable state updates, styled-components with theme tokens, and transient `$prop` names for styling-only props. Avoid `any`; TypeScript strict mode and unused-symbol checks are enabled. Preserve UTF-8 text because the UI contains German labels and symbols.

## Testing & Change Guidelines

No test framework, test files, or coverage requirement exists. Until tests are introduced, verify behavior manually plus `npm run lint` and `npm run build`. New tests should use `*.test.ts(x)` beside the tested unit and include a documented npm script.

Git history is unavailable in this checkout. Use focused commits with imperative subjects, for example `Fix task status updates`. Pull requests should describe behavior and verification, link issues, and include screenshots for UI changes. Do not claim placeholder modules, persistence, routing, or backend integration as implemented.
