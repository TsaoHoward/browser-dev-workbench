export type SnapshotConflictChoice = 'replace' | 'retain';

export function shouldReplaceSnapshot(
  hasExistingWorkspace: boolean,
  choice: SnapshotConflictChoice,
): boolean {
  return !hasExistingWorkspace || choice === 'replace';
}
