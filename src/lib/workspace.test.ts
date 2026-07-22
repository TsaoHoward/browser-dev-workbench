import { describe, expect, it } from 'vitest';
import { validateWorkspaceFiles, validateWorkspacePath } from './workspace';

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
});
