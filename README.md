# Browser Dev Workbench

A browser-hosted Svelte development workbench deployed as a static GitHub Pages application.
The shell is static; project installation, Node.js commands, and the Vite development server run
inside the user's browser through WebContainers.

This repository currently proves a narrow vertical slice rather than implementing a complete IDE.

## Current vertical slice

1. Load a built-in multi-file Svelte/Vite project.
2. Edit files in the browser.
3. Save and restore the workspace with IndexedDB.
4. Mount the workspace into a WebContainer.
5. Run `npm install` and retain the generated `package-lock.json` in browser storage.
6. Run `npm run dev` and stream process output into the runtime log.
7. Display the WebContainer server URL in an iframe.

The repository shell also includes linting, formatting, Svelte type checking, unit tests, a
production build, and a GitHub Pages deployment workflow.

## Architecture

```text
Svelte workbench UI
  ├─ workspace explorer + editor
  ├─ runtime controls + log
  └─ iframe preview
          │
Application boundary
  ├─ IndexedDbWorkspaceRepository
  ├─ WebContainerRuntime
  └─ GitHubService (non-privileged mock)
          │
Browser infrastructure
  ├─ IndexedDB
  ├─ WebContainer filesystem/processes
  └─ COOP/COEP service-worker shim
```

`src/fixtures` owns the example project. `src/services` contains browser and external runtime
adapters so that IndexedDB and WebContainer calls do not spread through Svelte components.
Browser storage is explicitly a temporary working layer; a GitHub repository is intended to be
the future versioned persistence layer.

## Run locally

Requirements: Node.js 22.12 or newer and a current Chromium-based browser. Vite 7 is used
deliberately because its JavaScript toolchain is already established in WebContainers; evaluating
Vite 8's Rolldown-based toolchain belongs in a separate compatibility upgrade.

```bash
npm ci
npm run dev
```

The first visit may reload once after `coi-serviceworker.js` gains control of the page. This is
needed because WebContainers require a cross-origin isolated page. Then select **Install & run
dev** and watch the runtime log.

Run all repository checks with:

```bash
npm run validate
```

## GitHub Pages

The Vite base path is `/browser-dev-workbench/`. The Pages workflow builds on `main` and deploys
the `dist` artifact. In repository settings, choose **GitHub Actions** as the Pages source.

GitHub Pages cannot configure custom COOP/COEP response headers. The project therefore includes
the MIT-licensed `coi-serviceworker` shim, which registers a service worker and reloads the page to
serve isolated responses. This is a feasibility mechanism and should be validated on the actual
Pages origin before treating deployment as complete.

## What is not implemented

- GitHub OAuth, repository loading/saving, commits, branches, pull requests, or Actions dispatch
- Monaco, language services, or a complete terminal emulator
- Creating/deleting files from the UI
- Synchronizing WebContainer filesystem changes other than the generated lockfile back to storage
- Multiple workspaces or target repositories
- Non-Svelte projects, large monorepos, collaboration, or a production security model
- Full offline PWA behavior

`MockGitHubService` intentionally rejects write and workflow operations. A future implementation
must use an explicit user authorization flow; tokens and client secrets must never enter the
static bundle.

## Known constraints

- WebContainers are best supported on Chromium. Other browsers are outside this milestone.
- Cross-origin isolation, service workers, SharedArrayBuffer availability, iframe behavior, and
  WebContainer networking must be verified on the deployed Pages origin.
- Browser storage can be evicted and is not a source of record.
- `npm install` cost depends on the dependency graph, browser memory, CPU, and network.
- WebContainer boot is limited to one instance per page. The runtime service reuses it.
- The code textarea is deliberately minimal; introducing Monaco should be a separate milestone.

## Next milestone

Add read-only GitHub repository import using an explicit repository/branch selector, convert the
imported tree into the workspace model, and define conflict behavior between the saved browser
snapshot and the selected GitHub commit. Only after that flow is verified should authenticated
commit, pull request, or workflow dispatch be added.
