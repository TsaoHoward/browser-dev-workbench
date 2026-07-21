import type { WorkspaceFile, WorkspaceSnapshot } from '../../lib/workspace';
import { cloneFiles } from '../../lib/workspace';

export interface WorkspaceRepository {
  load(): Promise<WorkspaceSnapshot | null>;
  save(files: WorkspaceFile[]): Promise<WorkspaceSnapshot>;
  clear(): Promise<void>;
}

const DATABASE_NAME = 'browser-dev-workbench';
const STORE_NAME = 'workspaces';
const WORKSPACE_KEY = 'default';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  readonly #indexedDb: IDBFactory;

  constructor(indexedDb: IDBFactory = window.indexedDB) {
    this.#indexedDb = indexedDb;
  }

  async load(): Promise<WorkspaceSnapshot | null> {
    const database = await this.#open();

    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const result = await requestResult<WorkspaceSnapshot | undefined>(
        transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY),
      );
      return result ? { ...result, files: cloneFiles(result.files) } : null;
    } finally {
      database.close();
    }
  }

  async save(files: WorkspaceFile[]): Promise<WorkspaceSnapshot> {
    const snapshot: WorkspaceSnapshot = {
      files: cloneFiles(files),
      savedAt: new Date().toISOString(),
      version: 1,
    };
    const database = await this.#open();

    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      await requestResult(transaction.objectStore(STORE_NAME).put(snapshot, WORKSPACE_KEY));
      return snapshot;
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await this.#open();

    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      await requestResult(transaction.objectStore(STORE_NAME).delete(WORKSPACE_KEY));
    } finally {
      database.close();
    }
  }

  #open(): Promise<IDBDatabase> {
    const request = this.#indexedDb.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    return requestResult(request);
  }
}
