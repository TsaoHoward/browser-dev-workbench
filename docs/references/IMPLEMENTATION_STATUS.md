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

The repository also provides linting, formatting, Svelte type checking, unit tests, a production
build, and a GitHub Pages deployment workflow. The local validation suite checks that the production
artifact uses the Pages base path and contains the COOP/COEP service-worker shim. After deployment,
the Pages workflow fetches the deployed HTML and verifies that its module, stylesheet, and service
worker resources are available, then runs a lightweight Chromium smoke test for the mounted app,
console/page errors, cross-origin isolation, and major workbench UI regions.

## Not implemented

- GitHub OAuth, authenticated repository loading/saving, commits, branches, pull requests, or
  Actions dispatch.
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

A future write capability must use an explicit user authorization flow; tokens and client secrets
must never enter the static bundle. The planned publish route is GitHub App device flow with a token
retained only in running page memory, not a backend or persistent browser credential store.

## Known constraints and verification status

- WebContainers are best supported on Chromium. Other browsers are outside this milestone.
- GitHub Pages deployment needs the COOP/COEP service-worker shim. Deployed HTML and static resource
  availability plus a lightweight browser smoke test are checked automatically after deployment;
  WebContainer boot, package installation, dev-server readiness, and iframe preview still require
  focused browser verification on the deployed Pages origin.
- Browser storage can be evicted and is not a source of record.
- `npm install` cost depends on the dependency graph, browser memory, CPU, and network.
- WebContainer boot is limited to one instance per page. The runtime service reuses it.
- The code textarea is deliberately minimal; introducing Monaco should be a separate milestone.

## Approved next work

The next planned capability is [session-only GitHub publish](../slices/planned/02-session-only-github-publish.md),
using device flow to create one reviewed commit on a new branch. Its authorization, permission,
device-flow, branch, diff, and browser-threat-model decisions must be agreed before activation.
Pull requests and workflow dispatch remain out of scope.
