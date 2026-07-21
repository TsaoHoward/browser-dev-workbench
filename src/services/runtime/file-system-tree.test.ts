import { describe, expect, it } from 'vitest';
import { buildFileSystemTree } from './file-system-tree';

describe('buildFileSystemTree', () => {
  it('converts flat workspace paths into the WebContainer mount shape', () => {
    expect(
      buildFileSystemTree([
        { path: 'package.json', contents: '{}' },
        { path: 'src/App.svelte', contents: '<h1>Hello</h1>' },
      ]),
    ).toEqual({
      'package.json': { file: { contents: '{}' } },
      src: {
        directory: {
          'App.svelte': { file: { contents: '<h1>Hello</h1>' } },
        },
      },
    });
  });

  it('rejects a path where a file blocks a directory', () => {
    expect(() =>
      buildFileSystemTree([
        { path: 'src', contents: 'file' },
        { path: 'src/App.svelte', contents: 'blocked' },
      ]),
    ).toThrow('A file blocks directory path');
  });
});
