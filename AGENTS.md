# Browser Dev Workbench agent guide

## Mission

Browser Dev Workbench explores how far a single static GitHub Pages site can take a zero-install,
browser-native front-end development workflow. The page is a bootloader, UI shell, and capability
orchestrator: it may load browser-local runtimes, storage, tools, and repository adapters on demand.

The core does not require a particular machine, preinstalled development software, a companion
service, or a GitHub sign-in. GitHub and other remote repositories are optional synchronization
adapters; they are not the workspace, local version-control, or runtime prerequisite.

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
- `src/services/` owns external and browser-runtime adapters. Keep browser capability detection,
  IndexedDB/OPFS, WebContainer/WASM runtimes, browser-local Git, filesystem interchange, and remote
  repository integration behind focused interfaces.
- `src/lib/` owns small, framework-independent workspace domain types and transformations.
- `src/fixtures/` owns the built-in sample workspace.
- Browser storage holds recoverable browser-local workspace and repository state, but can be evicted
  and never preserves running processes, terminals, or dev servers across reload. A remote
  repository is only the source of committed synchronization state after an explicit remote action.

## Non-negotiable safety rules

- Never ship a GitHub token, client secret, or other credential in source code, configuration, or
  the static bundle.
- Do not add GitHub writes, pull-request creation, or workflow dispatch without an explicit user
  authorization design and an approved slice.
- Preserve the one-WebContainer-per-page constraint. Reuse the runtime service rather than
  booting containers from UI components.
- Do not require host Git, Node.js, Docker, IDE software, SSH agents, credential managers, native
  bridges, extensions, or an application backend for a core workflow. Such integrations may only be
  separately scoped optional adapters.
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
