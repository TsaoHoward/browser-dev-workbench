import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbWorkspaceRepository, toWorkspacePersistenceError } from './workspace-repository';

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

    const saved = await repository.save({
      files: input,
      localRepository: { repositoryId: 'local-repository-1', storageVersion: 1 },
      selectedPath: 'src/App.svelte',
    });
    input[0].contents = 'mutated';
    const loaded = await repository.load();

    expect(saved).toMatchObject({
      version: 3,
      workspaceId: 'default',
      metadata: {
        editor: { selectedPath: 'src/App.svelte' },
        localRepository: { repositoryId: 'local-repository-1', storageVersion: 1 },
      },
    });
    expect(loaded).toMatchObject({
      files: [{ path: 'src/App.svelte', contents: '<h1>Hello</h1>' }],
      metadata: {
        editor: { selectedPath: 'src/App.svelte' },
        localRepository: { repositoryId: 'local-repository-1', storageVersion: 1 },
      },
    });
  });

  it('clears a saved workspace', async () => {
    const repository = new IndexedDbWorkspaceRepository(indexedDB);
    await repository.save({ files: [{ path: 'package.json', contents: '{}' }] });

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
      version: 3,
      workspaceId: 'default',
      metadata: { editor: {}, provenance: undefined },
    });
  });

  it('migrates version two import metadata into v3 provenance', async () => {
    const database = await openDatabase(2);
    database
      .transaction('workspaces', 'readwrite')
      .objectStore('workspaces')
      .put(
        {
          files: [{ path: 'package.json', contents: '{}' }],
          savedAt: '2026-07-22T00:00:00.000Z',
          version: 2,
          metadata: {
            kind: 'github',
            owner: 'sveltejs',
            repository: 'svelte',
            branch: 'main',
            commitSha: '0123456789abcdef',
            importedAt: '2026-07-22T00:00:00.000Z',
            snapshotConflict: 'replaced',
            ignoredPathCount: 2,
          },
        },
        'default',
      );
    database.close();

    const repository = new IndexedDbWorkspaceRepository(indexedDB);

    await expect(repository.load()).resolves.toMatchObject({
      version: 3,
      metadata: {
        editor: {},
        provenance: { kind: 'github', owner: 'sveltejs', ignoredPathCount: 2 },
      },
    });
  });

  it('rejects a corrupt current snapshot without returning its files', async () => {
    const database = await openDatabase(2);
    database
      .transaction('workspaces', 'readwrite')
      .objectStore('workspaces')
      .put(
        {
          files: [{ path: 'package.json', contents: 42 }],
          savedAt: '2026-07-22T00:00:00.000Z',
          version: 3,
          workspaceId: 'default',
          metadata: { editor: {} },
        },
        'default',
      );
    database.close();

    const repository = new IndexedDbWorkspaceRepository(indexedDB);

    await expect(repository.load()).rejects.toMatchObject({ code: 'corrupt-snapshot' });
  });

  it('rejects a workspace above the file-count budget before opening IndexedDB', async () => {
    const repository = new IndexedDbWorkspaceRepository(indexedDB);
    const files = Array.from({ length: 201 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      contents: '',
    }));

    await expect(repository.save({ files })).rejects.toMatchObject({ code: 'workspace-too-large' });
  });

  it('classifies quota failures separately from unavailable storage', () => {
    expect(
      toWorkspacePersistenceError(
        new DOMException('Full', 'QuotaExceededError'),
        'storage-unavailable',
      ),
    ).toMatchObject({ code: 'quota-exceeded' });
    expect(
      toWorkspacePersistenceError(new Error('No database'), 'storage-unavailable'),
    ).toMatchObject({
      code: 'storage-unavailable',
    });
  });
});

function openDatabase(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('browser-dev-workbench', version);
    request.onupgradeneeded = () => request.result.createObjectStore('workspaces');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
