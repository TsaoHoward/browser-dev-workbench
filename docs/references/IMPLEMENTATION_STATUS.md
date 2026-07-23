# Implementation status reference

This is the canonical reference for changing implementation state. Update it in the same pull
request as a change that materially alters delivered behavior, known constraints, verification
status, or the approved next implementation work. Do not duplicate this content in `README.md`.

## Delivered vertical slice

1. Load a built-in multi-file Svelte/Vite project.
2. Edit files in the browser.
3. Save and restore the workspace with IndexedDB.
4. Mount the workspace into a WebContainer.
5. Run `npm install` and retain the generated `package-lock.json` in browser storage.
6. Run `npm run dev` and stream process output into the runtime log.
7. Display the WebContainer server URL in an iframe.
8. Import a supported public GitHub repository branch into the browser workspace without credentials.

This delivered vertical slice demonstrates only one current capability combination: editor,
recoverable IndexedDB workspace, and a Chromium-focused WebContainer runtime. The public GitHub
import is a read-only remote-adapter proof; it is not the workspace's source of record or a
prerequisite for editing, runtime use, or future browser-local commits.

Slice 02 is active. The workbench now passively reports browser capability prerequisites and keeps
the Pages service-worker shim separate from WebContainer's secure-context, cross-origin-isolation,
and `SharedArrayBuffer` requirements. A user can explicitly probe storage estimation and OPFS
access; these results are page-session diagnostics, not a durability guarantee or an OPFS-backed
workspace. Runtime boot remains intent-triggered, and its boot outcome is cached separately from
mount, command, and dev-server lifecycle failures.

The repository also provides linting, formatting, Svelte type checking, unit tests, a production
build, and a GitHub Pages deployment workflow. The local validation suite checks that the production
artifact uses the Pages base path and contains the COOP/COEP service-worker shim. After deployment,
the Pages workflow fetches the deployed HTML and verifies that its module, stylesheet, and service
worker resources are available, then runs a lightweight Chromium smoke test for the mounted app,
console/page errors, cross-origin isolation, and major workbench UI regions.

## Not implemented

- OPFS-backed workspace/repository storage, selected-folder access, archive interchange, or an
  explicit reduced/portable runtime fallback.
- Browser-local Git: repository init, status, diff, staging, local commits, branches, history,
  checkout, patches, or bundles.
- Authenticated remote repository loading/saving, fetch/pull/push, GitHub OAuth or PAT handling,
  pull requests, or Actions dispatch.
- Monaco, language services, or a complete terminal emulator.
- Creating or deleting files from the UI.
- Synchronizing WebContainer filesystem changes other than the generated lockfile back to storage.
- Multiple workspaces or target repositories.
- Non-Svelte projects, large monorepos, collaboration, a production security model, or full offline
  PWA behavior.

Public imports use only an explicit owner, repository, and branch, resolve the branch to an immutable
commit SHA, and do not use credentials. Imports are limited to 200 regular UTF-8 text files, 1 MiB
per file, and 5 MiB total; binary files, symlinks, submodules, oversized or truncated trees are
rejected. Generated and sensitive paths (`.git`, `node_modules`, `dist`, `build`, `.svelte-kit`,
`coverage`, `.env`, and `.env.*`) are skipped. When a local snapshot or unsaved change exists, the
user explicitly chooses to replace the saved snapshot or retain it until a later save.

A future remote write capability must use an explicit user authorization flow; tokens and client
secrets must never enter the static bundle. Authentication is an optional Remote Repository Adapter
concern, not a prerequisite for Workspace Core, Runtime Adapters, or browser-local Version Control.

## Known constraints and verification status

- WebContainers are currently evidenced only on Chromium. Capability-based reduced and portable
  workflows are planned but not yet delivered; other-browser behavior remains unverified.
- GitHub Pages deployment needs the COOP/COEP service-worker shim. Deployed HTML and static resource
  availability plus a lightweight browser smoke test are checked automatically after deployment.
  The smoke coverage also exercises a deliberately unisolated page, where the runtime action must
  stay unavailable while editing remains usable, and a stubbed selected-folder diagnostic that must
  run only after its button is clicked. WebContainer boot, package installation, dev-server
  readiness, and iframe preview still require focused browser verification on the deployed Pages
  origin.
- Browser storage can be evicted. It may restore files and metadata when available, but it is not a
  remote source of record and does not restore running processes, terminal sessions, or dev servers.
- `npm install` cost depends on the dependency graph, browser memory, CPU, and network.
- WebContainer boot is limited to one instance per page. The runtime service reuses it.
- Dev-server startup reports ready, early exit, cancellation, or a 30-second startup timeout rather
  than remaining in a perpetual starting state. These outcomes do not mark the browser runtime
  capability unavailable.
- The code textarea is deliberately minimal; introducing Monaco should be a separate milestone.

## Active and next work

Slice 02 is the active implementation target. Its remaining exit work is deployed-origin browser
verification of the implemented capability loop, native selected-folder picker coverage, and
recording any deviations. The subsequent sequence remains intentionally capability-first:

1. [Slice 03 — Persistent browser workspace](../slices/planned/03-persistent-browser-workspace.md)
2. [Slice 04 — Browser-local version control](../slices/planned/04-browser-local-version-control.md)
3. [Slice 05 — Portable interchange](../slices/planned/05-portable-interchange.md)
4. [Slice 06 — Optional remote synchronization](../slices/planned/06-optional-remote-synchronization.md)

The former session-only GitHub publish plan is [superseded historical research](../slices/archive/02-session-only-github-publish.md),
not approved work. Its remote-authentication conclusions must be revalidated against official
documentation and a deployed-browser PoC before an implementation slice adopts them. Pull requests
and workflow dispatch remain out of scope.
