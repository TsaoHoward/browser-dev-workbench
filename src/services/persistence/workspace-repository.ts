import type {
  ImportedWorkspaceMetadata,
  LocalRepositoryLink,
  WorkspaceFile,
  WorkspaceMetadata,
  WorkspaceSnapshot,
} from '../../lib/workspace';
import {
  cloneFiles,
  cloneMetadata,
  cloneWorkspaceMetadata,
  validateWorkspaceFiles,
} from '../../lib/workspace';

export interface WorkspaceRepository {
  load(): Promise<WorkspaceSnapshot | null>;
  save(request: WorkspaceSaveRequest): Promise<WorkspaceSnapshot>;
  clear(): Promise<void>;
}

export interface WorkspaceSaveRequest {
  files: WorkspaceFile[];
  localRepository?: LocalRepositoryLink;
  provenance?: ImportedWorkspaceMetadata;
  selectedPath?: string;
  workspaceId?: string;
}

export type WorkspacePersistenceErrorCode =
  | 'corrupt-snapshot'
  | 'migration-failed'
  | 'quota-exceeded'
  | 'storage-unavailable'
  | 'workspace-too-large';

export class WorkspacePersistenceError extends Error {
  constructor(
    readonly code: WorkspacePersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WorkspacePersistenceError';
  }
}

const DATABASE_NAME = 'browser-dev-workbench';
const STORE_NAME = 'workspaces';
const WORKSPACE_KEY = 'default';
const CURRENT_SNAPSHOT_VERSION = 3;

interface LegacyWorkspaceSnapshot {
  files: WorkspaceFile[];
  savedAt: string;
  version: 1;
}

interface VersionTwoWorkspaceSnapshot {
  files: WorkspaceFile[];
  metadata?: ImportedWorkspaceMetadata;
  savedAt: string;
  version: 2;
}

type StoredWorkspaceSnapshot =
  LegacyWorkspaceSnapshot | VersionTwoWorkspaceSnapshot | WorkspaceSnapshot;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  readonly #indexedDb: IDBFactory;

  constructor(indexedDb: IDBFactory = window.indexedDB) {
    this.#indexedDb = indexedDb;
  }

  async load(): Promise<WorkspaceSnapshot | null> {
    try {
      const database = await this.#open();
      try {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const complete = transactionResult(transaction);
        const result = await requestResult<StoredWorkspaceSnapshot | undefined>(
          transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY),
        );
        await complete;
        return result ? toCurrentSnapshot(result) : null;
      } finally {
        database.close();
      }
    } catch (error) {
      throw toWorkspacePersistenceError(error, 'storage-unavailable');
    }
  }

  async save(request: WorkspaceSaveRequest): Promise<WorkspaceSnapshot> {
    try {
      validateWorkspaceFiles(request.files);
    } catch (error) {
      throw new WorkspacePersistenceError(
        'workspace-too-large',
        error instanceof Error ? error.message : 'The workspace cannot be saved.',
        { cause: error },
      );
    }

    const snapshot: WorkspaceSnapshot = {
      files: cloneFiles(request.files),
      savedAt: new Date().toISOString(),
      version: CURRENT_SNAPSHOT_VERSION,
      workspaceId: request.workspaceId ?? WORKSPACE_KEY,
      metadata: {
        editor: request.selectedPath ? { selectedPath: request.selectedPath } : {},
        localRepository: request.localRepository ? { ...request.localRepository } : undefined,
        provenance: cloneMetadata(request.provenance),
      },
    };

    try {
      const database = await this.#open();
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const complete = transactionResult(transaction);
        transaction.objectStore(STORE_NAME).put(snapshot, WORKSPACE_KEY);
        await complete;
        return copySnapshot(snapshot);
      } finally {
        database.close();
      }
    } catch (error) {
      throw toWorkspacePersistenceError(error, 'storage-unavailable');
    }
  }

  async clear(): Promise<void> {
    try {
      const database = await this.#open();
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const complete = transactionResult(transaction);
        transaction.objectStore(STORE_NAME).delete(WORKSPACE_KEY);
        await complete;
      } finally {
        database.close();
      }
    } catch (error) {
      throw toWorkspacePersistenceError(error, 'storage-unavailable');
    }
  }

  #open(): Promise<IDBDatabase> {
    try {
      const request = this.#indexedDb.open(DATABASE_NAME, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      return requestResult(request);
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

export function toWorkspacePersistenceError(
  error: unknown,
  fallback: WorkspacePersistenceErrorCode,
): WorkspacePersistenceError {
  if (error instanceof WorkspacePersistenceError) return error;
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new WorkspacePersistenceError(
      'quota-exceeded',
      'Browser storage is full. Keep editing in memory and clear saved data before saving again.',
      { cause: error },
    );
  }
  return new WorkspacePersistenceError(
    fallback,
    'Browser storage is unavailable. Keep editing in memory and retry or use portable recovery when available.',
    { cause: error },
  );
}

function toCurrentSnapshot(snapshot: StoredWorkspaceSnapshot): WorkspaceSnapshot {
  const version = isRecord(snapshot) ? snapshot.version : undefined;
  try {
    if (version === CURRENT_SNAPSHOT_VERSION) {
      const currentSnapshot = snapshot as WorkspaceSnapshot;
      validateCurrentSnapshot(currentSnapshot);
      return copySnapshot(currentSnapshot);
    }

    if (version === 1 || version === 2) {
      const legacySnapshot = snapshot as LegacyWorkspaceSnapshot | VersionTwoWorkspaceSnapshot;
      validateLegacySnapshot(legacySnapshot);
      return {
        files: cloneFiles(legacySnapshot.files),
        savedAt: legacySnapshot.savedAt,
        version: CURRENT_SNAPSHOT_VERSION,
        workspaceId: WORKSPACE_KEY,
        metadata: {
          editor: {},
          provenance:
            legacySnapshot.version === 2 ? cloneMetadata(legacySnapshot.metadata) : undefined,
        },
      };
    }
  } catch (error) {
    throw new WorkspacePersistenceError(
      version === 1 || version === 2 ? 'migration-failed' : 'corrupt-snapshot',
      'The saved workspace could not be recovered. Clear the saved browser copy or continue with the in-memory workspace.',
      { cause: error },
    );
  }

  throw new WorkspacePersistenceError(
    'migration-failed',
    'The saved workspace uses an unsupported format. Clear the saved browser copy or continue with the in-memory workspace.',
  );
}

function copySnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    files: cloneFiles(snapshot.files),
    savedAt: snapshot.savedAt,
    version: CURRENT_SNAPSHOT_VERSION,
    workspaceId: snapshot.workspaceId,
    metadata: cloneWorkspaceMetadata(snapshot.metadata),
  };
}

function validateCurrentSnapshot(snapshot: WorkspaceSnapshot): void {
  if (!isNonEmptyString(snapshot.workspaceId) || !isTimestamp(snapshot.savedAt)) {
    throw new Error('Workspace identity or timestamp is invalid.');
  }
  validateWorkspaceFiles(snapshot.files);
  if (!isWorkspaceMetadata(snapshot.metadata)) {
    throw new Error('Workspace metadata is invalid.');
  }
}

function validateLegacySnapshot(
  snapshot: LegacyWorkspaceSnapshot | VersionTwoWorkspaceSnapshot,
): void {
  if (!isTimestamp(snapshot.savedAt)) throw new Error('Workspace timestamp is invalid.');
  validateWorkspaceFiles(snapshot.files);
  if (
    snapshot.version === 2 &&
    snapshot.metadata &&
    !isImportedWorkspaceMetadata(snapshot.metadata)
  ) {
    throw new Error('Imported workspace metadata is invalid.');
  }
}

function isWorkspaceMetadata(value: unknown): value is WorkspaceMetadata {
  if (!isRecord(value) || !isRecord(value.editor)) return false;
  if (value.editor.selectedPath !== undefined && typeof value.editor.selectedPath !== 'string') {
    return false;
  }
  if (value.localRepository !== undefined) {
    if (
      !isRecord(value.localRepository) ||
      !isNonEmptyString(value.localRepository.repositoryId) ||
      !Number.isInteger(value.localRepository.storageVersion)
    ) {
      return false;
    }
  }
  return value.provenance === undefined || isImportedWorkspaceMetadata(value.provenance);
}

function isImportedWorkspaceMetadata(value: unknown): value is ImportedWorkspaceMetadata {
  if (!isRecord(value)) return false;
  return (
    value.kind === 'github' &&
    isNonEmptyString(value.owner) &&
    isNonEmptyString(value.repository) &&
    isNonEmptyString(value.branch) &&
    isNonEmptyString(value.commitSha) &&
    isTimestamp(value.importedAt) &&
    (value.snapshotConflict === 'replaced' || value.snapshotConflict === 'retained') &&
    Number.isInteger(value.ignoredPathCount) &&
    typeof value.ignoredPathCount === 'number' &&
    value.ignoredPathCount >= 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
