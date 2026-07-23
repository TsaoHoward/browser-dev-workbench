import { describe, expect, it, vi } from 'vitest';
import {
  BrowserCapabilityRegistry,
  detectPassiveCapabilities,
  type BrowserCapabilityDependencies,
} from './capability-registry';

const supportedBrowser: BrowserCapabilityDependencies = {
  crossOriginIsolated: true,
  directoryPicker: true,
  indexedDb: true,
  isSecureContext: true,
  opfs: true,
  serviceWorker: true,
  serviceWorkerControlled: true,
  sharedArrayBuffer: true,
  wasm: true,
  worker: true,
};

describe('detectPassiveCapabilities', () => {
  it('distinguishes passive availability from a usable runtime probe', () => {
    const snapshot = detectPassiveCapabilities(supportedBrowser);

    expect(snapshot['workspace-core'].state).toBe('ready');
    expect(snapshot['indexeddb-workspace'].state).toBe('available');
    expect(snapshot['opfs-storage'].state).toBe('available');
    expect(snapshot['selected-folder'].state).toBe('user-action-required');
    expect(snapshot['webcontainer-runtime'].state).toBe('not-probed');
    expect(snapshot['pages-isolation-shim'].state).toBe('ready');
  });

  it('reports the first missing runtime prerequisite without requiring service-worker control', () => {
    expect(
      detectPassiveCapabilities({
        ...supportedBrowser,
        crossOriginIsolated: false,
        serviceWorkerControlled: false,
      }),
    ).toMatchObject({
      'pages-isolation-shim': { state: 'available' },
      'webcontainer-runtime': {
        state: 'unavailable',
        reason: 'Cross-origin isolation is required.',
      },
    });
  });

  it('reports unavailable APIs and keeps a copied session snapshot', async () => {
    const registry = new BrowserCapabilityRegistry({
      ...supportedBrowser,
      directoryPicker: false,
      indexedDb: false,
      opfs: false,
      serviceWorker: false,
      wasm: false,
      worker: false,
    });
    registry.record('webcontainer-runtime', {
      state: 'failed',
      reason: 'The runtime could not boot. Retry when ready.',
    });

    const snapshot = registry.snapshot();
    snapshot['webcontainer-runtime'].state = 'ready';

    expect(registry.snapshot()).toMatchObject({
      'indexeddb-workspace': { state: 'unavailable' },
      'opfs-storage': { state: 'unavailable' },
      'selected-folder': { state: 'unavailable' },
      'pages-isolation-shim': { state: 'unavailable' },
      wasm: { state: 'unavailable' },
      worker: { state: 'unavailable' },
      'webcontainer-runtime': { state: 'failed' },
    });
    await expect(registry.probeSelectedFolder()).resolves.toEqual({
      state: 'unavailable',
      reason: 'Directory access is unavailable.',
    });
  });

  it('records successful and failed intent-triggered storage probes without exposing exceptions', async () => {
    const registry = new BrowserCapabilityRegistry(supportedBrowser, {
      estimateStorage: async () => ({ quota: 1024, usage: 12 }),
      getOpfsDirectory: async () => ({}),
    });

    await expect(registry.probeStorageEstimate()).resolves.toEqual({ state: 'ready' });
    await expect(registry.probeOpfs()).resolves.toEqual({ state: 'ready' });

    const failedRegistry = new BrowserCapabilityRegistry(supportedBrowser, {
      estimateStorage: async () => Promise.reject(new Error('private data')),
      getOpfsDirectory: async () => Promise.reject(new Error('private data')),
    });

    await expect(failedRegistry.probeStorageEstimate()).resolves.toEqual({
      state: 'failed',
      reason: 'Storage estimation failed.',
    });
    await expect(failedRegistry.probeOpfs()).resolves.toEqual({
      state: 'failed',
      reason: 'OPFS access failed.',
    });
  });

  it('does not select a folder until its explicit probe runs', async () => {
    const chooseDirectory = vi.fn().mockResolvedValue({});
    const registry = new BrowserCapabilityRegistry(supportedBrowser, { chooseDirectory });

    expect(chooseDirectory).not.toHaveBeenCalled();
    await expect(registry.probeSelectedFolder()).resolves.toEqual({ state: 'ready' });
    expect(chooseDirectory).toHaveBeenCalledOnce();
  });

  it('maps incomplete folder selection, post-selection permission denial, and failures', async () => {
    const notCompleted = new DOMException('picker closed', 'AbortError');
    const incompleteRegistry = new BrowserCapabilityRegistry(supportedBrowser, {
      chooseDirectory: async () => Promise.reject(notCompleted),
    });
    const deniedRegistry = new BrowserCapabilityRegistry(supportedBrowser, {
      chooseDirectory: async () => ({ queryPermission: async () => 'denied' }),
    });
    const failedRegistry = new BrowserCapabilityRegistry(supportedBrowser, {
      chooseDirectory: async () => Promise.reject(new Error('private data')),
    });

    await expect(incompleteRegistry.probeSelectedFolder()).resolves.toEqual({
      state: 'not-completed',
      reason: 'Folder selection was not completed.',
    });
    await expect(deniedRegistry.probeSelectedFolder()).resolves.toEqual({
      state: 'permission-denied',
      reason: 'The selected folder denied read permission.',
    });
    await expect(failedRegistry.probeSelectedFolder()).resolves.toEqual({
      state: 'failed',
      reason: 'Folder access failed.',
    });
  });
});
