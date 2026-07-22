import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbWorkspaceRepository } from './workspace-repository';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('browser-dev-workbench');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(deleteDatabase);

describe('IndexedDbWorkspaceRepository', () => {
  it('round-trips an isolated copy of the workspace', async () => {
    const repository = new IndexedDbWorkspaceRepository(indexedDB);
    const input = [{ path: 'src/App.svelte', contents: '<h1>Hello</h1>' }];

    const saved = await repository.save(input);
    input[0].contents = 'mutated';
    const loaded = await repository.load();

    expect(saved.version).toBe(2);
    expect(loaded?.files).toEqual([{ path: 'src/App.svelte', contents: '<h1>Hello</h1>' }]);
  });

  it('clears a saved workspace', async () => {
    const repository = new IndexedDbWorkspaceRepository(indexedDB);
    await repository.save([{ path: 'package.json', contents: '{}' }]);

    await repository.clear();

    await expect(repository.load()).resolves.toBeNull();
  });

  it('migrates a version one snapshot without import metadata', async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('browser-dev-workbench', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspaces');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database
      .transaction('workspaces', 'readwrite')
      .objectStore('workspaces')
      .put(
        {
          files: [{ path: 'package.json', contents: '{}' }],
          savedAt: '2026-07-22T00:00:00.000Z',
          version: 1,
        },
        'default',
      );
    database.close();

    const repository = new IndexedDbWorkspaceRepository(indexedDB);

    await expect(repository.load()).resolves.toEqual({
      files: [{ path: 'package.json', contents: '{}' }],
      savedAt: '2026-07-22T00:00:00.000Z',
      version: 2,
      metadata: undefined,
    });
  });
});
