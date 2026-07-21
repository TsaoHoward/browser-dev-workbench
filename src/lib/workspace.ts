export interface WorkspaceFile {
  path: string;
  contents: string;
}

export interface WorkspaceSnapshot {
  files: WorkspaceFile[];
  savedAt: string;
  version: 1;
}

export function cloneFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.map((file) => ({ ...file }));
}

export function upsertFile(files: WorkspaceFile[], nextFile: WorkspaceFile): WorkspaceFile[] {
  const exists = files.some((file) => file.path === nextFile.path);

  if (!exists) {
    return [...files, nextFile].sort((a, b) => a.path.localeCompare(b.path));
  }

  return files.map((file) => (file.path === nextFile.path ? nextFile : file));
}
