import type { WorkspaceFile } from '../../lib/workspace';

export interface RepositoryTarget {
  owner: string;
  repository: string;
  branch: string;
}

export interface GitHubService {
  loadWorkspace(target: RepositoryTarget): Promise<WorkspaceFile[]>;
  saveWorkspace(target: RepositoryTarget, files: WorkspaceFile[], message: string): Promise<string>;
  dispatchWorkflow(target: RepositoryTarget, workflowId: string): Promise<void>;
}

/**
 * Deliberately non-privileged placeholder. A real implementation must use an
 * explicit user authorization flow and must never embed a token in this app.
 */
export class MockGitHubService implements GitHubService {
  async loadWorkspace(): Promise<WorkspaceFile[]> {
    return [];
  }

  async saveWorkspace(): Promise<string> {
    throw new Error('GitHub writes are not enabled in this milestone.');
  }

  async dispatchWorkflow(): Promise<void> {
    throw new Error('Workflow dispatch is not enabled in this milestone.');
  }
}
