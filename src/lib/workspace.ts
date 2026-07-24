export interface WorkspaceFile {
  path: string;
  contents: string;
}

export interface ImportedWorkspaceMetadata {
  kind: 'github';
  owner: string;
  repository: string;
  branch: string;
  commitSha: string;
  importedAt: string;
  snapshotConflict: 'replaced' | 'retained';
  ignoredPathCount: number;
}

export interface WorkspaceEditorMetadata {
  selectedPath?: string;
}

export interface LocalRepositoryLink {
  repositoryId: string;
  storageVersion: number;
}

export interface WorkspaceMetadata {
  editor: WorkspaceEditorMetadata;
  localRepository?: LocalRepositoryLink;
  provenance?: ImportedWorkspaceMetadata;
}

export interface WorkspaceSnapshot {
  files: WorkspaceFile[];
  savedAt: string;
  version: 3;
  workspaceId: string;
  metadata: WorkspaceMetadata;
}

export const MAX_WORKSPACE_FILES = 200;
export const MAX_WORKSPACE_FILE_BYTES = 1024 * 1024;
export const MAX_WORKSPACE_TOTAL_BYTES = 5 * 1024 * 1024;

export function cloneFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.map((file) => ({ ...file }));
}

export function cloneMetadata(
  metadata: ImportedWorkspaceMetadata | undefined,
): ImportedWorkspaceMetadata | undefined {
  return metadata ? { ...metadata } : undefined;
}

export function cloneWorkspaceMetadata(metadata: WorkspaceMetadata): WorkspaceMetadata {
  return {
    editor: { ...metadata.editor },
    localRepository: metadata.localRepository ? { ...metadata.localRepository } : undefined,
    provenance: cloneMetadata(metadata.provenance),
  };
}

export function upsertFile(files: WorkspaceFile[], nextFile: WorkspaceFile): WorkspaceFile[] {
  const exists = files.some((file) => file.path === nextFile.path);

  if (!exists) {
    return [...files, nextFile].sort((a, b) => a.path.localeCompare(b.path));
  }

  return files.map((file) => (file.path === nextFile.path ? nextFile : file));
}

export function validateWorkspacePath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new Error(`Invalid workspace path: ${path}`);
  }

  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid workspace path: ${path}`);
  }
}

export function validateWorkspaceFiles(files: WorkspaceFile[]): void {
  if (files.length > MAX_WORKSPACE_FILES) {
    throw new Error(`A workspace can contain at most ${MAX_WORKSPACE_FILES} files.`);
  }

  const paths = new Set<string>();
  let totalBytes = 0;
  const encoder = new TextEncoder();

  for (const file of files) {
    if (typeof file.contents !== 'string') {
      throw new Error(`Workspace file contents must be text: ${file.path}`);
    }
    validateWorkspacePath(file.path);
    if (paths.has(file.path)) {
      throw new Error(`Duplicate workspace path: ${file.path}`);
    }
    paths.add(file.path);

    const fileBytes = encoder.encode(file.contents).byteLength;
    if (fileBytes > MAX_WORKSPACE_FILE_BYTES) {
      throw new Error(
        `Workspace file exceeds the ${MAX_WORKSPACE_FILE_BYTES} byte limit: ${file.path}`,
      );
    }
    totalBytes += fileBytes;
    if (totalBytes > MAX_WORKSPACE_TOTAL_BYTES) {
      throw new Error(
        `Workspace exceeds the ${MAX_WORKSPACE_TOTAL_BYTES} byte total storage limit.`,
      );
    }
  }
}
