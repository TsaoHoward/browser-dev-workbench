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

Slice 02 is complete. The workbench now passively reports browser capability prerequisites and keeps
the Pages service-worker shim separate from WebContainer's secure-context, cross-origin-isolation,
and `SharedArrayBuffer` requirements. A user can explicitly probe storage estimation and OPFS
access; these results are page-session diagnostics, not a durability guarantee or an OPFS-backed
workspace. Runtime boot remains intent-triggered, and its boot outcome is cached separately from
mount, command, and dev-server lifecycle failures.

The repository also provides linting, formatting, Svelte type checking, unit tests, a production
build, and a GitHub Pages deployment workflow. Same-repository pull requests deploy their merge
result to the public Pages origin and run a lightweight Chromium capability smoke suite before
merge; validation, deployment, or smoke failure restores the current `main` artifact. After merge,
the Pages workflow fetches the deployed HTML and verifies that its module, stylesheet, and service
worker resources are available, then runs the same smoke suite against the public origin.
The candidate rollback path has been exercised with an intentional post-deployment smoke failure:
it restored `main` and passed the same deployed-origin checks.

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
  Each smoke path records redacted, schema-versioned browser acceptance evidence and webpage
  screenshots as a 14-day workflow artifact. The current deployed origin passed all three
  deterministic harness paths in Chromium 149.0.7827.55; native folder selection and dismissal
  passed their human-gated reference checks at candidate commit `4af1f18`, with no console or page
  errors. The acceptance harness ignores only the known Pages `favicon.ico` 404 and reports every
  other failed resource as a redacted, reviewable error. Native post-selection `permission-denied`
  remains unavailable without retaining a handle, so the injected-boundary test is its evidence.
  The smoke coverage also exercises a deliberately unisolated page, where the runtime action must
  stay unavailable while editing remains usable, and a stubbed selected-folder diagnostic that must
  run only after its button is clicked. A focused Chromium post-merge check also passed the small
  fixture's WebContainer boot, package installation, dev-server readiness, and iframe preview;
  treat this as evidence rather than a timing guarantee or cross-browser claim.
- Browser storage can be evicted. It may restore files and metadata when available, but it is not a
  remote source of record and does not restore running processes, terminal sessions, or dev servers.
- `npm install` cost depends on the dependency graph, browser memory, CPU, and network.
- WebContainer boot is limited to one instance per page. The runtime service reuses it.
- Dev-server startup reports ready, early exit, cancellation, or a 30-second startup timeout rather
  than remaining in a perpetual starting state. These outcomes do not mark the browser runtime
  capability unavailable.
- The code textarea is deliberately minimal; introducing Monaco should be a separate milestone.

## Active and next work

Slice 07 is the active implementation target. It extends the delivered deterministic browser smoke
with structured evidence and a headed Playwright path for native selected-folder selection and
dismissal. MCP is optional agent-assisted diagnostics, not a prerequisite or merge gate. A native
post-selection permission denial is recorded only when the platform can expose it without retaining
a handle; otherwise the existing injected-boundary test is evidence and the native limitation is a
documented deviation. The native reference scenarios and all candidate deployment checks now pass;
the remaining Slice 07 exit work is the optional MCP-path evaluation and its decision record. The
subsequent sequence remains intentionally capability-first:

1. [Slice 07 — Semi-automated browser acceptance](../slices/active/07-semi-automated-browser-acceptance.md)
2. [Slice 03 — Persistent browser workspace](../slices/planned/03-persistent-browser-workspace.md)
3. [Slice 04 — Browser-local version control](../slices/planned/04-browser-local-version-control.md)
4. [Slice 05 — Portable interchange](../slices/planned/05-portable-interchange.md)
5. [Slice 06 — Optional remote synchronization](../slices/planned/06-optional-remote-synchronization.md)

The former session-only GitHub publish plan is [superseded historical research](../slices/archive/02-session-only-github-publish.md),
not approved work. Its remote-authentication conclusions must be revalidated against official
documentation and a deployed-browser PoC before an implementation slice adopts them. Pull requests
and workflow dispatch remain out of scope.
