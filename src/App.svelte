<script lang="ts">
  import { onMount } from 'svelte';
  import { starterProject } from './fixtures/starter-project';
  import { cloneFiles, upsertFile, type WorkspaceFile } from './lib/workspace';
  import { IndexedDbWorkspaceRepository } from './services/persistence/workspace-repository';
  import { WebContainerRuntime } from './services/runtime/webcontainer-runtime';

  type RuntimeStatus = 'idle' | 'preparing' | 'installing' | 'starting' | 'running' | 'error';

  let files: WorkspaceFile[] = cloneFiles(starterProject);
  let selectedPath = 'src/App.svelte';
  let status: RuntimeStatus = 'idle';
  let logs: string[] = ['Workbench ready.'];
  let previewUrl = '';
  let persistenceMessage = 'Browser workspace not yet saved';
  let dirty = false;
  let repository: IndexedDbWorkspaceRepository | null = null;

  const runtime = new WebContainerRuntime();

  $: selectedFile = files.find((file) => file.path === selectedPath);
  $: busy = ['preparing', 'installing', 'starting'].includes(status);

  onMount(async () => {
    repository = new IndexedDbWorkspaceRepository();
    try {
      const saved = await repository.load();
      if (saved) {
        files = saved.files;
        selectedPath = files.some((file) => file.path === selectedPath)
          ? selectedPath
          : (files[0]?.path ?? '');
        persistenceMessage = `Restored ${files.length} files saved ${formatTimestamp(saved.savedAt)}`;
      }
    } catch (error) {
      appendLog(`Persistence unavailable: ${errorMessage(error)}`);
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
      const snapshot = await repository.save(files);
      dirty = false;
      persistenceMessage = `Saved ${files.length} files ${formatTimestamp(snapshot.savedAt)}`;
      appendLog('Workspace saved to IndexedDB.');
    } catch (error) {
      appendLog(`Save failed: ${errorMessage(error)}`);
    }
  }

  async function resetWorkspace(): Promise<void> {
    files = cloneFiles(starterProject);
    selectedPath = 'src/App.svelte';
    previewUrl = '';
    dirty = true;
    if (repository) await repository.clear();
    persistenceMessage = 'Example restored; save to persist it';
    appendLog('Restored the built-in example workspace.');
  }

  async function prepareWorkspace(): Promise<boolean> {
    status = 'preparing';
    previewUrl = '';
    try {
      await runtime.prepare(files, appendLog);
      return true;
    } catch (error) {
      status = 'error';
      appendLog(`Runtime error: ${errorMessage(error)}`);
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
    try {
      status = 'preparing';
      await runtime.prepare(files, appendLog);

      if (!runtime.dependenciesReady(files)) {
        status = 'installing';
        await runtime.install(appendLog);
        const lockfile = await runtime.readTextFile('package-lock.json');
        files = upsertFile(files, { path: 'package-lock.json', contents: lockfile });
        dirty = true;
        await saveWorkspace();
      }

      status = 'starting';
      previewUrl = await runtime.startDevServer(appendLog);
      status = 'running';
      appendLog(`Preview ready at ${previewUrl}`);
    } catch (error) {
      status = 'error';
      appendLog(`Start failed: ${errorMessage(error)}`);
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
    <span class:ready={globalThis.crossOriginIsolated} class="capability">
      <i></i>
      {globalThis.crossOriginIsolated ? 'isolated runtime ready' : 'isolation pending'}
    </span>
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
        <button class="primary large" onclick={startDevServer} disabled={busy}>
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
        <button onclick={installDependencies} disabled={busy}>npm install</button>
        <button onclick={startDevServer} disabled={busy}>npm run dev</button>
      </div>
    </div>
    <pre aria-live="polite">{logs.length ? logs.join('\n') : 'No output yet.'}</pre>
  </section>
</main>
