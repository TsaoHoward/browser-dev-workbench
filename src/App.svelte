<script lang="ts">
  import { onMount } from 'svelte';
  import { starterProject } from './fixtures/starter-project';
  import {
    cloneFiles,
    upsertFile,
    type ImportedWorkspaceMetadata,
    type WorkspaceFile,
  } from './lib/workspace';
  import { shouldReplaceSnapshot, type SnapshotConflictChoice } from './lib/import-conflict';
  import {
    PublicGitHubImportService,
    type RepositoryTarget,
  } from './services/github/github-service';
  import {
    BrowserCapabilityRegistry,
    capabilityLabel,
    type CapabilitySnapshot,
  } from './services/capabilities/capability-registry';
  import { IndexedDbWorkspaceRepository } from './services/persistence/workspace-repository';
  import {
    RuntimeOperationError,
    WebContainerRuntime,
  } from './services/runtime/webcontainer-runtime';

  type RuntimeStatus = 'idle' | 'preparing' | 'installing' | 'starting' | 'running' | 'error';
  let files: WorkspaceFile[] = cloneFiles(starterProject);
  let selectedPath = 'src/App.svelte';
  let status: RuntimeStatus = 'idle';
  let logs: string[] = ['Workbench ready.'];
  let previewUrl = '';
  let persistenceMessage = 'Browser workspace not yet saved';
  let dirty = false;
  let repository: IndexedDbWorkspaceRepository | null = null;
  let importedMetadata: ImportedWorkspaceMetadata | undefined;
  let hasSavedSnapshot = false;
  let importDialogOpen = false;
  let importTarget: RepositoryTarget = { owner: '', repository: '', branch: 'main' };
  let snapshotConflictChoice: SnapshotConflictChoice = 'replace';
  let importLoading = false;
  let importError = '';
  let ignoredImportPathCount = 0;
  let folderProbeLoading = false;
  let storageProbeLoading = false;
  let startController: AbortController | null = null;

  const capabilityRegistry = new BrowserCapabilityRegistry();
  const runtime = new WebContainerRuntime();
  const github = new PublicGitHubImportService();
  let capabilities: CapabilitySnapshot = capabilityRegistry.snapshot();

  $: selectedFile = files.find((file) => file.path === selectedPath);
  $: busy = ['preparing', 'installing', 'starting'].includes(status);
  $: hasImportConflict = hasSavedSnapshot || dirty;
  $: runtimeCapability = capabilities['webcontainer-runtime'];
  $: runtimeActionDisabled = busy || runtimeCapability.state === 'unavailable';
  $: capabilityEntries = [
    ['Workspace core', capabilities['workspace-core']],
    ['IndexedDB', capabilities['indexeddb-workspace']],
    ['OPFS', capabilities['opfs-storage']],
    ['Selected folder', capabilities['selected-folder']],
    ['Pages isolation shim', capabilities['pages-isolation-shim']],
    ['Worker', capabilities.worker],
    ['WebAssembly', capabilities.wasm],
  ] as const;

  onMount(async () => {
    repository = new IndexedDbWorkspaceRepository();
    try {
      const saved = await repository.load();
      if (saved) {
        files = saved.files;
        importedMetadata = saved.metadata;
        ignoredImportPathCount = saved.metadata?.ignoredPathCount ?? 0;
        hasSavedSnapshot = true;
        selectedPath = files.some((file) => file.path === selectedPath)
          ? selectedPath
          : (files[0]?.path ?? '');
        persistenceMessage = `Restored ${files.length} files saved ${formatTimestamp(saved.savedAt)}`;
      }
      capabilityRegistry.record('indexeddb-workspace', { state: 'ready' });
      refreshCapabilities();
    } catch (error) {
      capabilityRegistry.record('indexeddb-workspace', {
        state: 'failed',
        reason: persistenceErrorMessage(error),
      });
      refreshCapabilities();
      appendLog(`Persistence unavailable: ${persistenceErrorMessage(error)}`);
    }
  });

  function appendLog(message: string): void {
    const lines = message
      .replaceAll('\r', '')
      .split('\n')
      .filter((line) => line.length > 0);
    logs = [...logs, ...lines].slice(-300);
  }

  function updateSelectedFile(contents: string): void {
    if (!selectedFile) return;
    files = upsertFile(files, { path: selectedFile.path, contents });
    dirty = true;
  }

  async function saveWorkspace(): Promise<void> {
    if (!repository) return;
    try {
      const snapshot = await repository.save(files, importedMetadata);
      dirty = false;
      hasSavedSnapshot = true;
      persistenceMessage = `Saved ${files.length} files ${formatTimestamp(snapshot.savedAt)}`;
      capabilityRegistry.record('indexeddb-workspace', { state: 'ready' });
      refreshCapabilities();
      appendLog('Workspace saved to IndexedDB.');
    } catch (error) {
      capabilityRegistry.record('indexeddb-workspace', {
        state: 'failed',
        reason: persistenceErrorMessage(error),
      });
      refreshCapabilities();
      appendLog(`Save failed: ${persistenceErrorMessage(error)}`);
    }
  }

  async function resetWorkspace(): Promise<void> {
    files = cloneFiles(starterProject);
    selectedPath = 'src/App.svelte';
    previewUrl = '';
    dirty = true;
    importedMetadata = undefined;
    hasSavedSnapshot = false;
    if (repository) await repository.clear();
    persistenceMessage = 'Example restored; save to persist it';
    appendLog('Restored the built-in example workspace.');
  }

  function openImportDialog(): void {
    importError = '';
    ignoredImportPathCount = 0;
    importDialogOpen = true;
  }

  function closeImportDialog(): void {
    if (!importLoading) {
      importDialogOpen = false;
      importError = '';
    }
  }

  async function importRepository(): Promise<void> {
    if (!repository) return;

    importLoading = true;
    importError = '';
    try {
      const imported = await github.importWorkspace({
        owner: importTarget.owner.trim(),
        repository: importTarget.repository.trim(),
        branch: importTarget.branch.trim(),
      });
      const metadata: ImportedWorkspaceMetadata = {
        ...imported.metadata,
        snapshotConflict: snapshotConflictChoice === 'replace' ? 'replaced' : 'retained',
        ignoredPathCount: imported.ignoredPaths.length,
      };

      files = imported.files;
      selectedPath = files[0]?.path ?? '';
      previewUrl = '';
      importedMetadata = metadata;
      ignoredImportPathCount = imported.ignoredPaths.length;

      if (!shouldReplaceSnapshot(hasImportConflict, snapshotConflictChoice)) {
        dirty = true;
        persistenceMessage =
          'Saved local snapshot retained; save this import when you are ready to replace it';
        appendLog(`Imported ${files.length} files without changing the saved local snapshot.`);
      } else {
        const snapshot = await repository.save(files, metadata);
        dirty = false;
        hasSavedSnapshot = true;
        persistenceMessage = `Imported ${files.length} files and replaced the saved snapshot ${formatTimestamp(snapshot.savedAt)}`;
        appendLog(
          `Imported ${files.length} files from ${metadata.owner}/${metadata.repository}@${metadata.commitSha.slice(0, 12)}.`,
        );
      }

      if (imported.ignoredPaths.length) {
        appendLog(
          `Skipped ${imported.ignoredPaths.length} ignored path${imported.ignoredPaths.length === 1 ? '' : 's'}.`,
        );
      }
      importDialogOpen = false;
    } catch (error) {
      importError = errorMessage(error);
    } finally {
      importLoading = false;
    }
  }

  async function prepareWorkspace(): Promise<boolean> {
    status = 'preparing';
    previewUrl = '';
    try {
      await runtime.prepare(files, appendLog);
      capabilityRegistry.record('webcontainer-runtime', { state: 'ready' });
      refreshCapabilities();
      return true;
    } catch (error) {
      status = 'error';
      recordRuntimeFailure(error);
      appendLog(`Runtime error: ${runtimeErrorMessage(error)}`);
      return false;
    }
  }

  async function installDependencies(): Promise<boolean> {
    if (runtime.dependenciesReady(files)) return true;
    if (!(await prepareWorkspace())) return false;
    status = 'installing';
    try {
      await runtime.install(appendLog);
      const lockfile = await runtime.readTextFile('package-lock.json');
      files = upsertFile(files, { path: 'package-lock.json', contents: lockfile });
      dirty = true;
      await saveWorkspace();
      status = 'idle';
      return true;
    } catch (error) {
      status = 'error';
      appendLog(`Install failed: ${errorMessage(error)}`);
      return false;
    }
  }

  async function startDevServer(): Promise<void> {
    if (!(await prepareWorkspace())) return;

    try {
      if (!runtime.dependenciesReady(files)) {
        status = 'installing';
        await runtime.install(appendLog);
        const lockfile = await runtime.readTextFile('package-lock.json');
        files = upsertFile(files, { path: 'package-lock.json', contents: lockfile });
        dirty = true;
        await saveWorkspace();
      }

      status = 'starting';
      startController = new AbortController();
      previewUrl = await runtime.startDevServer(appendLog, { signal: startController.signal });
      status = 'running';
      appendLog(`Preview ready at ${previewUrl}`);
    } catch (error) {
      status = 'error';
      recordRuntimeFailure(error);
      appendLog(`Start failed: ${runtimeErrorMessage(error)}`);
    } finally {
      startController = null;
    }
  }

  function cancelDevServerStart(): void {
    startController?.abort();
  }

  function refreshCapabilities(): void {
    capabilities = capabilityRegistry.snapshot();
  }

  async function probeStorageCapabilities(): Promise<void> {
    storageProbeLoading = true;
    try {
      const [storage, opfs] = await Promise.all([
        capabilityRegistry.probeStorageEstimate(),
        capabilityRegistry.probeOpfs(),
      ]);
      refreshCapabilities();
      appendLog(`Storage probe: IndexedDB ${storage.state}; OPFS ${opfs.state}.`);
    } finally {
      storageProbeLoading = false;
    }
  }

  async function probeSelectedFolder(): Promise<void> {
    folderProbeLoading = true;
    try {
      const folder = await capabilityRegistry.probeSelectedFolder();
      refreshCapabilities();
      appendLog(`Selected-folder probe: ${folder.state}.`);
    } finally {
      folderProbeLoading = false;
    }
  }

  function recordRuntimeFailure(error: unknown): void {
    if (!(error instanceof RuntimeOperationError)) return;
    if (error.code === 'boot-failed') {
      capabilityRegistry.record('webcontainer-runtime', {
        state: 'failed',
        reason: 'The runtime boot probe failed. Retry is available.',
      });
      refreshCapabilities();
    }
    if (error.code === 'runtime-unavailable') {
      capabilityRegistry.record('webcontainer-runtime', {
        state: 'unavailable',
        reason: 'Runtime prerequisites are unavailable.',
      });
      refreshCapabilities();
    }
  }

  function formatTimestamp(timestamp: string): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function runtimeErrorMessage(error: unknown): string {
    return error instanceof RuntimeOperationError
      ? error.message
      : 'The browser runtime operation failed. Check the runtime log and retry.';
  }

  function persistenceErrorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return 'Browser storage is full. Keep editing in memory and export or clear space before saving.';
    }
    return 'Browser storage is unavailable. Keep editing in memory and retry or use a portable export when available.';
  }
</script>

<svelte:head>
  <meta name="theme-color" content="#0b0f17" />
</svelte:head>

<header class="topbar">
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">BD</span>
    <div>
      <strong>Browser Dev Workbench</strong>
      <span>WebContainer feasibility slice</span>
    </div>
  </div>
  <div class="header-actions">
    <span
      class:ready={runtimeCapability.state === 'ready'}
      class="capability"
      title={capabilityLabel(runtimeCapability)}
    >
      <i></i>
      {runtimeCapability.state === 'ready'
        ? 'runtime ready'
        : runtimeCapability.state === 'not-probed'
          ? 'runtime can start'
          : runtimeCapability.state === 'failed'
            ? 'runtime retry available'
            : 'runtime unavailable'}
    </span>
    <button class="secondary" onclick={openImportDialog} disabled={!repository || busy}
      >Import GitHub</button
    >
    <button class="secondary" onclick={resetWorkspace} disabled={busy}>Reset example</button>
    <button class="primary" onclick={saveWorkspace} disabled={!repository || busy}>
      {dirty ? 'Save workspace*' : 'Workspace saved'}
    </button>
  </div>
</header>

<main class="workbench">
  <aside class="explorer panel">
    <div class="panel-title">
      <span>Workspace</span>
      <small>{files.length} files</small>
    </div>
    <nav aria-label="Workspace files">
      {#each files as file (file.path)}
        <button
          class:active={selectedPath === file.path}
          onclick={() => (selectedPath = file.path)}
        >
          <span class="file-icon">{file.path.endsWith('.svelte') ? 'S' : '<>'}</span>
          {file.path}
        </button>
      {/each}
    </nav>
    <div class="storage-note">
      <strong>Browser storage</strong>
      <span>{persistenceMessage}</span>
    </div>
    <div class="capability-note" aria-label="Browser capability results">
      <strong>Capabilities</strong>
      {#each capabilityEntries as [name, result] (name)}
        <span title={capabilityLabel(result)}>{name}: {result.state}</span>
      {/each}
      <button
        class="capability-probe"
        onclick={probeStorageCapabilities}
        disabled={storageProbeLoading}
        >{storageProbeLoading ? 'Checking storage…' : 'Check storage'}</button
      >
      <button
        class="capability-probe"
        onclick={probeSelectedFolder}
        disabled={folderProbeLoading || capabilities['selected-folder'].state === 'unavailable'}
        >{folderProbeLoading ? 'Checking folder…' : 'Check folder access'}</button
      >
    </div>
    {#if importedMetadata}
      <div class="import-note">
        <strong>GitHub import</strong>
        <span
          >{importedMetadata.owner}/{importedMetadata.repository} · {importedMetadata.branch}</span
        >
        <code title={importedMetadata.commitSha}>{importedMetadata.commitSha.slice(0, 12)}</code>
        <span>
          {importedMetadata.snapshotConflict === 'replaced'
            ? 'Saved snapshot replaced'
            : 'Previous snapshot retained'}
        </span>
        {#if ignoredImportPathCount}
          <span>{ignoredImportPathCount} ignored path{ignoredImportPathCount === 1 ? '' : 's'}</span
          >
        {/if}
      </div>
    {/if}
  </aside>

  <section class="editor panel">
    <div class="panel-title editor-title">
      <span>{selectedPath}</span>
      <small>{selectedFile?.contents.length ?? 0} chars</small>
    </div>
    {#if selectedFile}
      <textarea
        aria-label={`Editing ${selectedFile.path}`}
        spellcheck="false"
        value={selectedFile.contents}
        oninput={(event) => updateSelectedFile(event.currentTarget.value)}></textarea>
    {:else}
      <div class="empty-state">Select a file to edit.</div>
    {/if}
  </section>

  <section class="preview panel">
    <div class="panel-title">
      <span>Preview</span>
      <small>{status}</small>
    </div>
    {#if previewUrl}
      <iframe src={previewUrl} title="WebContainer development server preview"></iframe>
    {:else}
      <div class="preview-placeholder">
        <div class="preview-glyph">▶</div>
        <strong>Preview is waiting</strong>
        <p>Install the workspace dependencies, then start the Vite development server.</p>
        <button class="primary large" onclick={startDevServer} disabled={runtimeActionDisabled}>
          {busy ? 'Working…' : 'Install & run dev'}
        </button>
      </div>
    {/if}
  </section>

  <section class="terminal panel">
    <div class="panel-title terminal-title">
      <span>Runtime log</span>
      <div>
        <button onclick={() => (logs = [])}>Clear</button>
        <button onclick={installDependencies} disabled={runtimeActionDisabled}>npm install</button>
        <button onclick={startDevServer} disabled={runtimeActionDisabled}>npm run dev</button>
        {#if status === 'starting'}
          <button onclick={cancelDevServerStart}>Cancel start</button>
        {/if}
      </div>
    </div>
    <pre aria-live="polite">{logs.length ? logs.join('\n') : 'No output yet.'}</pre>
  </section>
</main>

{#if importDialogOpen}
  <div class="dialog-backdrop">
    <dialog open class="import-dialog" aria-labelledby="import-dialog-title">
      <div class="dialog-heading">
        <div>
          <span class="eyebrow">Public GitHub repository</span>
          <h1 id="import-dialog-title">Import a branch</h1>
        </div>
        <button
          class="close-button"
          aria-label="Close import dialog"
          onclick={closeImportDialog}
          disabled={importLoading}>×</button
        >
      </div>
      <p class="dialog-copy">
        GitHub is read without credentials. The import uses the selected branch's immutable commit
        and never writes to GitHub.
      </p>
      <div class="target-fields">
        <label>
          Owner
          <input
            bind:value={importTarget.owner}
            placeholder="sveltejs"
            autocomplete="off"
            disabled={importLoading}
          />
        </label>
        <label>
          Repository
          <input
            bind:value={importTarget.repository}
            placeholder="svelte"
            autocomplete="off"
            disabled={importLoading}
          />
        </label>
        <label>
          Branch
          <input
            bind:value={importTarget.branch}
            placeholder="main"
            autocomplete="off"
            disabled={importLoading}
          />
        </label>
      </div>
      <p class="import-limits">
        Text-only UTF-8 files: up to 200 files, 1 MiB per file, 5 MiB total. Symlinks, submodules,
        binary files, and oversized trees are rejected. Generated and sensitive paths such as <code
          >node_modules</code
        >, <code>dist</code>, and <code>.env*</code> are skipped.
      </p>
      {#if hasImportConflict}
        <fieldset class="conflict-choice" disabled={importLoading}>
          <legend>Current browser workspace</legend>
          <label>
            <input type="radio" bind:group={snapshotConflictChoice} value="replace" />
            Replace the saved snapshot with this import
          </label>
          <label>
            <input type="radio" bind:group={snapshotConflictChoice} value="retain" />
            Retain the saved snapshot; keep this import only until you explicitly save it
          </label>
        </fieldset>
      {/if}
      {#if importError}
        <p class="import-error" role="alert">{importError}</p>
      {/if}
      <div class="dialog-actions">
        <button class="secondary" onclick={closeImportDialog} disabled={importLoading}
          >Cancel</button
        >
        <button class="primary" onclick={importRepository} disabled={importLoading}>
          {importLoading ? 'Importing…' : 'Review & import'}
        </button>
      </div>
    </dialog>
  </div>
{/if}
