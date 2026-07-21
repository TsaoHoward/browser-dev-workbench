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

The repository also provides linting, formatting, Svelte type checking, unit tests, a production
build, and a GitHub Pages deployment workflow.

## Not implemented

- GitHub OAuth, repository loading/saving, commits, branches, pull requests, or Actions dispatch.
- Monaco, language services, or a complete terminal emulator.
- Creating or deleting files from the UI.
- Synchronizing WebContainer filesystem changes other than the generated lockfile back to storage.
- Multiple workspaces or target repositories.
- Non-Svelte projects, large monorepos, collaboration, a production security model, or full offline
  PWA behavior.

`MockGitHubService` intentionally rejects write and workflow operations. A future implementation
must use an explicit user authorization flow; tokens and client secrets must never enter the static
bundle.

## Known constraints and verification status

- WebContainers are best supported on Chromium. Other browsers are outside this milestone.
- GitHub Pages deployment needs the COOP/COEP service-worker shim. Service-worker reload,
  cross-origin isolation, WebContainer boot, package installation, dev-server readiness, and iframe
  preview still require verification on the deployed Pages origin.
- Browser storage can be evicted and is not a source of record.
- `npm install` cost depends on the dependency graph, browser memory, CPU, and network.
- WebContainer boot is limited to one instance per page. The runtime service reuses it.
- The code textarea is deliberately minimal; introducing Monaco should be a separate milestone.

## Approved next work

The next planned slice is [read-only GitHub import](../slices/planned/01-readonly-github-import.md).
It must resolve its listed access, supported-file, snapshot-conflict, metadata, and UI-state
decisions before activation. Authenticated commits, pull requests, and workflow dispatch remain
out of scope until the read-only flow is verified.
