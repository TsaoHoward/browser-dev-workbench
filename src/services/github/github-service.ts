import type { ImportedWorkspaceMetadata, WorkspaceFile } from '../../lib/workspace';
import { validateWorkspaceFiles, validateWorkspacePath } from '../../lib/workspace';

const API_URL = 'https://api.github.com';
const RAW_URL = 'https://raw.githubusercontent.com';

export const MAX_IMPORT_FILE_COUNT = 200;
export const MAX_IMPORT_FILE_SIZE_BYTES = 1024 * 1024;
export const MAX_IMPORT_TOTAL_SIZE_BYTES = 5 * 1024 * 1024;

export interface RepositoryTarget {
  owner: string;
  repository: string;
  branch: string;
}

export interface ImportedWorkspace {
  files: WorkspaceFile[];
  metadata: Omit<ImportedWorkspaceMetadata, 'snapshotConflict' | 'ignoredPathCount'>;
  ignoredPaths: string[];
}

export interface GitHubImportService {
  importWorkspace(target: RepositoryTarget): Promise<ImportedWorkspace>;
}

export type GitHubImportErrorCode =
  | 'invalid-target'
  | 'not-found'
  | 'rate-limited'
  | 'network'
  | 'service'
  | 'unsupported-entry'
  | 'too-large'
  | 'invalid-file';

export class GitHubImportError extends Error {
  constructor(
    readonly code: GitHubImportErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'GitHubImportError';
  }
}

interface GitHubCommitResponse {
  sha: string;
}

interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class PublicGitHubImportService implements GitHubImportService {
  constructor(
    private readonly fetcher: FetchLike = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async importWorkspace(target: RepositoryTarget): Promise<ImportedWorkspace> {
    validateRepositoryTarget(target);

    const commit = await this.#getJson<GitHubCommitResponse>(
      `${API_URL}/repos/${encodeSegment(target.owner)}/${encodeSegment(target.repository)}/commits/${encodeSegment(target.branch)}`,
    );
    if (!isSha(commit.sha)) {
      throw new GitHubImportError('service', 'GitHub returned an invalid commit reference.', true);
    }

    const tree = await this.#getJson<GitHubTreeResponse>(
      `${API_URL}/repos/${encodeSegment(target.owner)}/${encodeSegment(target.repository)}/git/trees/${commit.sha}?recursive=1`,
    );
    if (tree.truncated) {
      throw new GitHubImportError(
        'too-large',
        'This repository tree is too large for the browser import limit.',
        false,
      );
    }
    if (!Array.isArray(tree.tree)) {
      throw new GitHubImportError('service', 'GitHub returned an invalid repository tree.', true);
    }

    const { supportedEntries, ignoredPaths } = selectSupportedEntries(tree.tree);
    const files = await this.#downloadFiles(target, commit.sha, supportedEntries);
    validateWorkspaceFiles(files);

    return {
      files,
      ignoredPaths,
      metadata: {
        kind: 'github',
        owner: target.owner,
        repository: target.repository,
        branch: target.branch,
        commitSha: commit.sha,
        importedAt: this.now().toISOString(),
      },
    };
  }

  async #getJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch {
      throw new GitHubImportError(
        'network',
        'GitHub could not be reached. Check your connection and try again.',
        true,
      );
    }

    if (!response.ok) {
      throw responseError(response);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new GitHubImportError('service', 'GitHub returned an unreadable response.', true);
    }
  }

  async #downloadFiles(
    target: RepositoryTarget,
    commitSha: string,
    entries: GitHubTreeEntry[],
  ): Promise<WorkspaceFile[]> {
    const files: WorkspaceFile[] = [];
    let totalBytes = 0;

    for (const entry of entries) {
      if (entry.size !== undefined && entry.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        throw fileSizeError(entry.path);
      }

      const response = await this.#getRawFile(target, commitSha, entry.path);
      const { contents, byteLength } = await decodeTextFile(response, entry.path);
      const bytes = byteLength;
      if (bytes > MAX_IMPORT_FILE_SIZE_BYTES) {
        throw fileSizeError(entry.path);
      }
      totalBytes += bytes;
      if (totalBytes > MAX_IMPORT_TOTAL_SIZE_BYTES) {
        throw new GitHubImportError(
          'too-large',
          `Supported files exceed the ${formatBytes(MAX_IMPORT_TOTAL_SIZE_BYTES)} import limit.`,
          false,
        );
      }
      files.push({ path: entry.path, contents });
    }

    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  async #getRawFile(target: RepositoryTarget, commitSha: string, path: string): Promise<Response> {
    const encodedPath = path.split('/').map(encodeSegment).join('/');
    let response: Response;
    try {
      response = await this.fetcher(
        `${RAW_URL}/${encodeSegment(target.owner)}/${encodeSegment(target.repository)}/${commitSha}/${encodedPath}`,
      );
    } catch {
      throw new GitHubImportError(
        'network',
        `Could not download ${path}. Check your connection and try again.`,
        true,
      );
    }

    if (!response.ok) {
      throw responseError(response, path);
    }
    return response;
  }
}

export function validateRepositoryTarget(target: RepositoryTarget): void {
  const segment = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/;
  if (!segment.test(target.owner) || !segment.test(target.repository)) {
    throw new GitHubImportError(
      'invalid-target',
      'Enter a GitHub owner and repository using letters, numbers, dots, hyphens, or underscores.',
      false,
    );
  }
  if (!target.branch.trim() || target.branch.length > 255 || target.branch.includes('..')) {
    throw new GitHubImportError('invalid-target', 'Enter a valid GitHub branch name.', false);
  }
}

function selectSupportedEntries(entries: GitHubTreeEntry[]): {
  supportedEntries: GitHubTreeEntry[];
  ignoredPaths: string[];
} {
  const supportedEntries: GitHubTreeEntry[] = [];
  const ignoredPaths: string[] = [];

  for (const entry of entries) {
    if (!isTreeEntry(entry)) {
      throw new GitHubImportError('service', 'GitHub returned an invalid repository entry.', true);
    }
    if (entry.type === 'tree') continue;
    if (isIgnoredPath(entry.path)) {
      ignoredPaths.push(entry.path);
      continue;
    }
    if (entry.type !== 'blob' || entry.mode === '120000') {
      throw new GitHubImportError(
        'unsupported-entry',
        `${entry.path} is a symlink or submodule, which this importer does not support.`,
        false,
      );
    }
    if (!entry.mode.startsWith('100')) {
      throw new GitHubImportError(
        'unsupported-entry',
        `${entry.path} is not a regular file, which this importer does not support.`,
        false,
      );
    }
    try {
      validateWorkspacePath(entry.path);
    } catch {
      throw new GitHubImportError(
        'invalid-file',
        `${entry.path} has an unsafe workspace path and cannot be imported.`,
        false,
      );
    }
    supportedEntries.push(entry);
  }

  if (supportedEntries.length > MAX_IMPORT_FILE_COUNT) {
    throw new GitHubImportError(
      'too-large',
      `This repository has more than ${MAX_IMPORT_FILE_COUNT} supported files.`,
      false,
    );
  }
  return { supportedEntries, ignoredPaths };
}

function isIgnoredPath(path: string): boolean {
  const ignoredDirectories = ['.git', 'node_modules', 'dist', 'build', '.svelte-kit', 'coverage'];
  const parts = path.split('/');
  const fileName = parts.at(-1) ?? '';
  return (
    parts.some((part) => ignoredDirectories.includes(part)) ||
    fileName === '.env' ||
    fileName.startsWith('.env.')
  );
}

async function decodeTextFile(
  response: Response,
  path: string,
): Promise<{ contents: string; byteLength: number }> {
  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    throw new GitHubImportError('network', `Could not read ${path}. Try the import again.`, true);
  }
  if (bytes.byteLength > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw fileSizeError(path);
  }

  try {
    const contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (contents.includes('\0')) {
      throw new TypeError('NUL byte');
    }
    return { contents, byteLength: bytes.byteLength };
  } catch {
    throw new GitHubImportError(
      'invalid-file',
      `${path} is binary or not valid UTF-8 text, which this importer does not support.`,
      false,
    );
  }
}

function responseError(response: Response, path?: string): GitHubImportError {
  if (response.status === 404) {
    return new GitHubImportError(
      'not-found',
      path
        ? `${path} was not found at the selected commit. Try importing again.`
        : 'The owner, repository, or branch was not found or is not public.',
      false,
    );
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    const reset = response.headers.get('x-ratelimit-reset');
    const retryAt = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'later';
    return new GitHubImportError(
      'rate-limited',
      `GitHub's public API rate limit was reached. Retry after ${retryAt}.`,
      true,
    );
  }
  return new GitHubImportError(
    'service',
    `GitHub returned ${response.status}. ${response.status >= 500 ? 'Try again shortly.' : 'Check the repository and branch.'}`,
    response.status >= 500,
  );
}

function fileSizeError(path: string): GitHubImportError {
  return new GitHubImportError(
    'too-large',
    `${path} exceeds the ${formatBytes(MAX_IMPORT_FILE_SIZE_BYTES)} per-file import limit.`,
    false,
  );
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

function isTreeEntry(value: unknown): value is GitHubTreeEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<GitHubTreeEntry>;
  return (
    typeof entry.path === 'string' &&
    typeof entry.mode === 'string' &&
    typeof entry.sha === 'string' &&
    (entry.type === 'blob' || entry.type === 'tree' || entry.type === 'commit')
  );
}
