# Browser Dev Workbench

A browser-hosted Svelte development workbench deployed as a static GitHub Pages application. It
explores the practical limit of a zero-install front-end workflow: the static page bootstraps a UI
and selects browser-native capabilities such as WebContainer, WASM tools, storage, local Git, and
optional repository adapters on demand.

It does not require host Git, Node.js, Docker, an IDE, a companion service, or GitHub
authentication for core editing, execution, or browser-local commits. Remote repositories are
optional synchronization and collaboration boundaries, never the workspace's immediate persistence
layer.

For the current implementation status, known constraints, and planned work, see the
[implementation status reference](docs/references/IMPLEMENTATION_STATUS.md).

## Contributor and agent guidance

The repository's durable contribution guidance lives in [AGENTS.md](AGENTS.md), the
[project conventions](docs/PROJECT_CONVENTIONS.md), and the [slice index](docs/slices/README.md).
Read those documents before changing code; the slice index identifies the current implementation
target, when one is active, and the approved next slice.

## Architecture

```text
Svelte workbench UI
  ├─ workspace explorer + editor
  ├─ runtime controls + log
  └─ iframe preview
          │
Workspace Core
  ├─ files, editor state, workspace metadata
  └─ provider- and runtime-independent domain transformations
          │
Adapter boundary
  ├─ runtime: WebContainer, workers, WASM, fallback tools
  ├─ storage: IndexedDB, OPFS, selected folders, archives
  ├─ version control: browser-local Git and patch/bundle interchange
  └─ remote repositories: public import and optional authenticated sync
```

`src/fixtures` owns the example project. `src/services` contains browser and external adapters so
that browser APIs, runtimes, local Git, and remote providers do not spread through Svelte
components. Browser storage may be recoverable but is evictable; processes and dev servers do not
survive reload. A remote repository records only explicitly synchronized, committed state.

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
