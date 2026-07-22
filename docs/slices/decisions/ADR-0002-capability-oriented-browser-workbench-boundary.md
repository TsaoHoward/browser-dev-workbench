# ADR-0002 — Capability-oriented browser workbench boundary

| Field  | Value      |
| ------ | ---------- |
| Status | accepted   |
| Date   | 2026-07-22 |

## Context

The initial vertical slice proved a small Svelte workspace can be edited, saved, mounted, and run
in a WebContainer from a static GitHub Pages deployment. Its first follow-up plan incorrectly made
GitHub device-flow publishing the next architectural dependency. That would have treated GitHub
authentication and remote publishing as prerequisites for local version control and obscured what a
static browser application can do without host tooling or an application backend.

## Decision

Treat the static page as a zero-install development-environment bootloader, UI shell, and
capability orchestrator. Keep five explicit boundaries:

1. **Workspace Core** owns multi-file workspace data, editor state, file operations, metadata, and
   provider- and runtime-independent transformations.
2. **Runtime Adapters** own WebContainer, workers, WASM toolchains, and reduced fallbacks for
   install, scripts, build, test, validation, preview, and their process lifecycle.
3. **Storage Adapters** own recoverable files and metadata in IndexedDB, OPFS, selected folders,
   and archives. They do not claim to restore running processes, terminal sessions, or dev servers.
4. **Version Control** is browser-local first: repository init, status, diff, staging, commits,
   branches, history, checkout, and patch or bundle interchange do not require remote credentials.
5. **Remote Repository Adapters** own import, fetch, pull, push, and remote-state comparison. A
   GitHub REST client, Git Smart HTTP, session-only PAT, OAuth broker, extension, native bridge, or
   archive handoff is an optional adapter, never a Workspace Core or Version Control dependency.

Derive the available workflow from individually detected capabilities. Full, reduced, and portable
workflows are progressive capability results, not separately hard-coded products. Do not assert a
capability, compatibility, or security property without an appropriate browser PoC or official
documentation.

## Consequences

- WebContainer remains one optional full-runtime adapter and retains the one-instance-per-page
  constraint. Current Chromium behavior is useful evidence, not the whole product definition.
- IndexedDB remains recoverable but evictable browser-local state. A remote repository is a source
  of explicitly committed and synchronized history, not a per-keystroke or process-state store.
- Slice planning validates capability and browser-local repository loops before selecting an
  authenticated GitHub transport. Browser-local commits remain available while disconnected.
- No core workflow may require host Git, Node.js, Docker, an IDE, a companion service, SSH-agent or
  credential-manager access, a client secret, or an undeclared backend.
- Adapter interfaces remain focused on actual consumers. Do not create a generic provider framework
  before at least two concrete adapters need a stable shared contract.
