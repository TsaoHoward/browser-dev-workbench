export type CapabilityState =
  | 'available'
  | 'failed'
  | 'not-completed'
  | 'not-probed'
  | 'permission-denied'
  | 'ready'
  | 'unavailable'
  | 'user-action-required';

export type CapabilityId =
  | 'indexeddb-workspace'
  | 'opfs-storage'
  | 'pages-isolation-shim'
  | 'selected-folder'
  | 'webcontainer-runtime'
  | 'wasm'
  | 'worker'
  | 'workspace-core';

export interface CapabilityResult {
  state: CapabilityState;
  reason?: string;
}

export type CapabilitySnapshot = Record<CapabilityId, CapabilityResult>;

export interface BrowserCapabilityDependencies {
  crossOriginIsolated: boolean;
  directoryPicker: boolean;
  indexedDb: boolean;
  isSecureContext: boolean;
  opfs: boolean;
  serviceWorker: boolean;
  serviceWorkerControlled: boolean;
  sharedArrayBuffer: boolean;
  wasm: boolean;
  worker: boolean;
}

export interface BrowserCapabilityProbes {
  chooseDirectory?: () => Promise<SelectedFolderHandle>;
  estimateStorage?: () => Promise<StorageEstimate>;
  getOpfsDirectory?: () => Promise<unknown>;
}

export interface SelectedFolderHandle {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export interface StorageEstimateMeasurement {
  quota: number;
  usage: number;
}

export function readBrowserCapabilityDependencies(): BrowserCapabilityDependencies {
  const browser = globalThis as typeof globalThis & {
    showDirectoryPicker?: unknown;
  };
  const storage = navigator.storage as StorageManager & { getDirectory?: unknown };

  return {
    crossOriginIsolated: globalThis.crossOriginIsolated,
    directoryPicker: typeof browser.showDirectoryPicker === 'function',
    indexedDb: typeof indexedDB !== 'undefined',
    isSecureContext: globalThis.isSecureContext,
    opfs: typeof storage?.getDirectory === 'function',
    serviceWorker: 'serviceWorker' in navigator,
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined',
    worker: typeof Worker !== 'undefined',
  };
}

export function readBrowserCapabilityProbes(): BrowserCapabilityProbes {
  const browser = globalThis as typeof globalThis & {
    showDirectoryPicker?: () => Promise<SelectedFolderHandle>;
  };
  const storage = navigator.storage as StorageManager & {
    estimate?: () => Promise<StorageEstimate>;
    getDirectory?: () => Promise<unknown>;
  };
  return {
    chooseDirectory: browser.showDirectoryPicker?.bind(browser),
    estimateStorage: storage?.estimate?.bind(storage),
    getOpfsDirectory: storage?.getDirectory?.bind(storage),
  };
}

export function detectPassiveCapabilities(
  dependencies: BrowserCapabilityDependencies,
): CapabilitySnapshot {
  const runtimeUnavailableReason = !dependencies.isSecureContext
    ? 'A secure context is required.'
    : !dependencies.crossOriginIsolated
      ? 'Cross-origin isolation is required.'
      : !dependencies.sharedArrayBuffer
        ? 'SharedArrayBuffer is unavailable.'
        : undefined;

  return {
    'workspace-core': { state: 'ready' },
    'indexeddb-workspace': dependencies.indexedDb
      ? { state: 'available' }
      : { state: 'unavailable', reason: 'IndexedDB is unavailable.' },
    'opfs-storage': dependencies.opfs
      ? { state: 'available' }
      : { state: 'unavailable', reason: 'Origin-private file storage is unavailable.' },
    'selected-folder': dependencies.directoryPicker
      ? { state: 'user-action-required' }
      : { state: 'unavailable', reason: 'Directory access is unavailable.' },
    'webcontainer-runtime': runtimeUnavailableReason
      ? { state: 'unavailable', reason: runtimeUnavailableReason }
      : { state: 'not-probed' },
    'pages-isolation-shim': !dependencies.serviceWorker
      ? { state: 'unavailable', reason: 'Service workers are unavailable.' }
      : dependencies.serviceWorkerControlled
        ? { state: 'ready' }
        : { state: 'available', reason: 'Waiting for service-worker control.' },
    worker: dependencies.worker
      ? { state: 'available' }
      : { state: 'unavailable', reason: 'Workers are unavailable.' },
    wasm: dependencies.wasm
      ? { state: 'available' }
      : { state: 'unavailable', reason: 'WebAssembly is unavailable.' },
  };
}

export class BrowserCapabilityRegistry {
  #probes: BrowserCapabilityProbes;
  #snapshot: CapabilitySnapshot;
  #storageEstimate: StorageEstimateMeasurement | null = null;

  constructor(
    dependencies: BrowserCapabilityDependencies = readBrowserCapabilityDependencies(),
    probes: BrowserCapabilityProbes = readBrowserCapabilityProbes(),
  ) {
    this.#snapshot = detectPassiveCapabilities(dependencies);
    this.#probes = probes;
  }

  get(id: CapabilityId): CapabilityResult {
    return this.#snapshot[id];
  }

  snapshot(): CapabilitySnapshot {
    return structuredClone(this.#snapshot);
  }

  storageEstimate(): StorageEstimateMeasurement | null {
    return this.#storageEstimate ? { ...this.#storageEstimate } : null;
  }

  record(id: CapabilityId, result: CapabilityResult): void {
    this.#snapshot[id] = result;
  }

  async probeStorageEstimate(): Promise<CapabilityResult> {
    if (this.get('indexeddb-workspace').state === 'unavailable') {
      return this.get('indexeddb-workspace');
    }
    if (!this.#probes.estimateStorage) {
      const result = { state: 'failed', reason: 'Storage estimation is unavailable.' } as const;
      this.record('indexeddb-workspace', result);
      return result;
    }
    try {
      const estimate = await this.#probes.estimateStorage();
      const result = Number.isFinite(estimate.quota)
        ? ({ state: 'ready' } as const)
        : ({ state: 'failed', reason: 'Storage quota is unavailable.' } as const);
      this.#storageEstimate =
        result.state === 'ready'
          ? { quota: estimate.quota!, usage: Number.isFinite(estimate.usage) ? estimate.usage! : 0 }
          : null;
      this.record('indexeddb-workspace', result);
      return result;
    } catch {
      this.#storageEstimate = null;
      const result = { state: 'failed', reason: 'Storage estimation failed.' } as const;
      this.record('indexeddb-workspace', result);
      return result;
    }
  }

  async probeOpfs(): Promise<CapabilityResult> {
    if (this.get('opfs-storage').state === 'unavailable') return this.get('opfs-storage');
    if (!this.#probes.getOpfsDirectory) {
      const result = { state: 'failed', reason: 'OPFS access is unavailable.' } as const;
      this.record('opfs-storage', result);
      return result;
    }
    try {
      await this.#probes.getOpfsDirectory();
      const result = { state: 'ready' } as const;
      this.record('opfs-storage', result);
      return result;
    } catch {
      const result = { state: 'failed', reason: 'OPFS access failed.' } as const;
      this.record('opfs-storage', result);
      return result;
    }
  }

  async probeSelectedFolder(): Promise<CapabilityResult> {
    if (this.get('selected-folder').state === 'unavailable') {
      return this.get('selected-folder');
    }
    if (!this.#probes.chooseDirectory) {
      const result = { state: 'failed', reason: 'Directory access could not be started.' } as const;
      this.record('selected-folder', result);
      return result;
    }
    try {
      const handle = await this.#probes.chooseDirectory();
      const permission = await handle.queryPermission?.({ mode: 'read' });
      const result =
        permission === 'denied'
          ? ({
              state: 'permission-denied',
              reason: 'The selected folder denied read permission.',
            } as const)
          : ({ state: 'ready' } as const);
      this.record('selected-folder', result);
      return result;
    } catch (error) {
      const result =
        error instanceof DOMException && error.name === 'AbortError'
          ? ({
              state: 'not-completed',
              reason: 'Folder selection was not completed.',
            } as const)
          : ({ state: 'failed', reason: 'Folder access failed.' } as const);
      this.record('selected-folder', result);
      return result;
    }
  }
}

export function capabilityLabel(result: CapabilityResult): string {
  if (result.reason) return `${result.state}: ${result.reason}`;
  return result.state.replaceAll('-', ' ');
}
