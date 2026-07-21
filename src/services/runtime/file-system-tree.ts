import type { FileSystemTree } from '@webcontainer/api';
import type { WorkspaceFile } from '../../lib/workspace';

interface MutableDirectory {
  [name: string]: { directory: MutableDirectory } | { file: { contents: string } };
}

export function buildFileSystemTree(files: WorkspaceFile[]): FileSystemTree {
  const root: MutableDirectory = {};

  for (const workspaceFile of files) {
    const parts = workspaceFile.path.split('/').filter(Boolean);
    const fileName = parts.pop();

    if (!fileName) {
      throw new Error(`Invalid workspace path: ${workspaceFile.path}`);
    }

    let directory = root;
    for (const part of parts) {
      const existing = directory[part];
      if (existing && 'file' in existing) {
        throw new Error(`A file blocks directory path: ${workspaceFile.path}`);
      }
      if (!existing) {
        directory[part] = { directory: {} };
      }
      directory = (directory[part] as { directory: MutableDirectory }).directory;
    }

    directory[fileName] = { file: { contents: workspaceFile.contents } };
  }

  return root as FileSystemTree;
}
