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

    expect(saved.version).toBe(1);
    expect(loaded?.files).toEqual([{ path: 'src/App.svelte', contents: '<h1>Hello</h1>' }]);
  });

  it('clears a saved workspace', async () => {
    const repository = new IndexedDbWorkspaceRepository(indexedDB);
    await repository.save([{ path: 'package.json', contents: '{}' }]);

    await repository.clear();

    await expect(repository.load()).resolves.toBeNull();
  });
});
