import { describe, expect, it, vi } from 'vitest';
import {
  GitHubImportError,
  MAX_IMPORT_FILE_COUNT,
  PublicGitHubImportService,
  validateRepositoryTarget,
} from './github-service';

const target = { owner: 'sveltejs', repository: 'template', branch: 'main' };
const commitSha = 'a'.repeat(40);

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('PublicGitHubImportService', () => {
  it('imports regular UTF-8 files, skips generated paths, and records immutable metadata', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            { path: 'src/App.svelte', mode: '100644', type: 'blob', sha: 'b'.repeat(40), size: 14 },
            {
              path: 'node_modules/library/index.js',
              mode: '100644',
              type: 'blob',
              sha: 'c'.repeat(40),
              size: 4,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response('<h1>Hello</h1>'));
    const service = new PublicGitHubImportService(
      fetcher,
      () => new Date('2026-07-22T12:00:00.000Z'),
    );

    await expect(service.importWorkspace(target)).resolves.toEqual({
      files: [{ path: 'src/App.svelte', contents: '<h1>Hello</h1>' }],
      ignoredPaths: ['node_modules/library/index.js'],
      metadata: {
        kind: 'github',
        owner: 'sveltejs',
        repository: 'template',
        branch: 'main',
        commitSha,
        importedAt: '2026-07-22T12:00:00.000Z',
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][0]).toContain(`/sveltejs/template/${commitSha}/src/App.svelte`);
  });

  it('rejects symlinks and binary files without accepting a partial workspace', async () => {
    const symlinkFetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [{ path: 'linked-file', mode: '120000', type: 'blob', sha: 'b'.repeat(40) }],
        }),
      );
    await expect(
      new PublicGitHubImportService(symlinkFetcher).importWorkspace(target),
    ).rejects.toMatchObject({
      code: 'unsupported-entry',
    });

    const binaryFetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [{ path: 'logo.png', mode: '100644', type: 'blob', sha: 'b'.repeat(40) }],
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 255, 1])));
    await expect(
      new PublicGitHubImportService(binaryFetcher).importWorkspace(target),
    ).rejects.toMatchObject({
      code: 'invalid-file',
    });

    const unsafePathFetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [{ path: '../outside', mode: '100644', type: 'blob', sha: 'b'.repeat(40) }],
        }),
      );
    await expect(
      new PublicGitHubImportService(unsafePathFetcher).importWorkspace(target),
    ).rejects.toMatchObject({ code: 'invalid-file' });
  });

  it('maps rate limits and network failures to actionable service errors', async () => {
    const rateLimited = vi.fn().mockResolvedValue(
      new Response('', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1780000000' },
      }),
    );
    await expect(
      new PublicGitHubImportService(rateLimited).importWorkspace(target),
    ).rejects.toMatchObject({
      code: 'rate-limited',
      retryable: true,
    });

    await expect(
      new PublicGitHubImportService(
        vi.fn().mockRejectedValue(new Error('offline')),
      ).importWorkspace(target),
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });

  it('rejects oversize trees before downloading their files', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sha: commitSha }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: Array.from({ length: MAX_IMPORT_FILE_COUNT + 1 }, (_, index) => ({
            path: `src/${index}.ts`,
            mode: '100644',
            type: 'blob',
            sha: 'b'.repeat(40),
          })),
        }),
      );

    await expect(
      new PublicGitHubImportService(fetcher).importWorkspace(target),
    ).rejects.toMatchObject({
      code: 'too-large',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('validateRepositoryTarget', () => {
  it('rejects unsafe repository targets before making a request', () => {
    expect(() => validateRepositoryTarget({ ...target, owner: '../owner' })).toThrow(
      GitHubImportError,
    );
    expect(() => validateRepositoryTarget({ ...target, branch: 'main..old' })).toThrow(
      'valid GitHub branch',
    );
  });
});
