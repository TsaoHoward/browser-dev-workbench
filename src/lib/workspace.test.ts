import { describe, expect, it } from 'vitest';
import {
  MAX_WORKSPACE_FILES,
  MAX_WORKSPACE_FILE_BYTES,
  validateWorkspaceFiles,
  validateWorkspacePath,
} from './workspace';

describe('workspace validation', () => {
  it.each([
    '../package.json',
    '/package.json',
    'src\\App.svelte',
    'src//App.svelte',
    'src/./App.svelte',
  ])('rejects an unsafe path: %s', (path) => {
    expect(() => validateWorkspacePath(path)).toThrow('Invalid workspace path');
  });

  it('rejects duplicate paths before mounting a workspace', () => {
    expect(() =>
      validateWorkspaceFiles([
        { path: 'src/App.svelte', contents: 'first' },
        { path: 'src/App.svelte', contents: 'second' },
      ]),
    ).toThrow('Duplicate workspace path');
  });

  it('enforces the workspace file-count and UTF-8 file-size budgets', () => {
    expect(() =>
      validateWorkspaceFiles(
        Array.from({ length: MAX_WORKSPACE_FILES + 1 }, (_, index) => ({
          path: `src/${index}.ts`,
          contents: '',
        })),
      ),
    ).toThrow('at most');
    expect(() =>
      validateWorkspaceFiles([
        { path: 'src/large.ts', contents: 'x'.repeat(MAX_WORKSPACE_FILE_BYTES + 1) },
      ]),
    ).toThrow('exceeds');
  });
});
