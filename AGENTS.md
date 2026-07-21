# Browser Dev Workbench agent guide

## Mission

Browser Dev Workbench is a static GitHub Pages application that lets a user edit and run a small
Svelte project entirely in their browser through WebContainers.

Before changing code, read in this order:

1. This file.
2. [Project conventions](docs/PROJECT_CONVENTIONS.md).
3. [Slice index](docs/slices/README.md).
4. [Implementation status reference](docs/references/IMPLEMENTATION_STATUS.md).
5. The one current document in `docs/slices/active/`, if the index has an active target.

Read the planned next slice when scoping upcoming work. Read archived slices only when their history
is relevant to the work.

## Documentation maintenance

- Keep `README.md` limited to durable project orientation: purpose, architecture, setup, deployment,
  and links to canonical documents.
- Do not add current progress, completed features, unimplemented work, milestone status, validation
  results, dated claims, or next actions to `README.md`. Update
  `docs/references/IMPLEMENTATION_STATUS.md` instead and link to it from the README.
- Put bounded implementation scope, decisions, risks, acceptance criteria, and exit conditions in
  slice documents. Put historical outcomes in `docs/slices/archive/`.
- When a code change affects implementation state, update the implementation status reference and
  the relevant slice in the same pull request. When it does not, do not manufacture a status update.

## Architecture boundaries

- Svelte components coordinate UI and must not absorb browser infrastructure or GitHub API logic.
- `src/services/` owns external and browser-runtime adapters. Keep IndexedDB, WebContainer, and
  GitHub integration behind focused interfaces.
- `src/lib/` owns small, framework-independent workspace domain types and transformations.
- `src/fixtures/` owns the built-in sample workspace.
- IndexedDB is a disposable browser working copy, never the authoritative repository history.

## Non-negotiable safety rules

- Never ship a GitHub token, client secret, or other credential in source code, configuration, or
  the static bundle.
- Do not add GitHub writes, pull-request creation, or workflow dispatch without an explicit user
  authorization design and an approved slice.
- Preserve the one-WebContainer-per-page constraint. Reuse the runtime service rather than
  booting containers from UI components.
- Treat browser capability, cross-origin isolation, service-worker behavior, and deployed Pages
  verification as part of the product boundary, not incidental implementation detail.

## Required validation

Run `npm run validate` for production code, dependency, configuration, or workflow changes. For a
documentation-only change, run at least `npm run format:check`; run the full command whenever the
documentation changes validation instructions or claims verified behavior.

## Session handoff

End implementation sessions with: current slice and status, changed files, decisions or
deviations, validation results, unresolved questions or risks, and one exact next action. Record
durable context in the active slice rather than leaving it only in chat history.

Nested `AGENTS.md` files may add directory-specific instructions, but may not silently contradict
this file.
