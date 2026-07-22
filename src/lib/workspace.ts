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

export interface WorkspaceSnapshot {
  files: WorkspaceFile[];
  savedAt: string;
  version: 2;
  metadata?: ImportedWorkspaceMetadata;
}

export function cloneFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.map((file) => ({ ...file }));
}

export function cloneMetadata(
  metadata: ImportedWorkspaceMetadata | undefined,
): ImportedWorkspaceMetadata | undefined {
  return metadata ? { ...metadata } : undefined;
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
  const paths = new Set<string>();

  for (const file of files) {
    validateWorkspacePath(file.path);
    if (paths.has(file.path)) {
      throw new Error(`Duplicate workspace path: ${file.path}`);
    }
    paths.add(file.path);
  }
}
