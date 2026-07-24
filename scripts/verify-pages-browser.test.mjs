import { describe, expect, it } from 'vitest';

import {
  createAcceptanceEvidence,
  isExpectedResourceFailure,
  isGenericResourceConsoleError,
  parseBrowserAcceptanceArguments,
  redactError,
  redactUrl,
} from './verify-pages-browser.mjs';

describe('browser acceptance arguments', () => {
  it('requires a headed session for a native folder action', () => {
    expect(() =>
      parseBrowserAcceptanceArguments([
        'https://example.test/workbench/',
        '--native-folder',
        'selected',
      ]),
    ).toThrow('--native-folder requires --headed');
  });

  it('accepts a headed native dismissal scenario', () => {
    expect(
      parseBrowserAcceptanceArguments([
        'https://example.test/workbench/',
        '--native-folder',
        'dismissed',
        '--headed',
        '--target-commit',
        'abc123',
      ]),
    ).toMatchObject({
      headed: true,
      nativeFolderOutcome: 'dismissed',
      targetCommit: 'abc123',
    });
  });

  it('rejects an incomplete artifact destination', () => {
    expect(() =>
      parseBrowserAcceptanceArguments(['https://example.test/workbench/', '--evidence-dir']),
    ).toThrow('--evidence-dir requires a directory');
  });
});

describe('browser acceptance evidence', () => {
  it('removes credentials and paths from reviewable evidence', () => {
    const evidence = createAcceptanceEvidence({
      actions: [{ id: 'navigate', result: 'passed' }],
      artifacts: ['completed.png'],
      browserVersion: '149.0',
      capabilities: 'Selected folder: ready',
      errors: [{ source: 'page', message: 'open /private/example/token=secret' }],
      scenario: 'folder-native-selected',
      serviceWorkerControlled: true,
      targetCommit: 'abc123',
      targetUrl: 'https://user:password@example.test/app/?token=secret#fragment',
      crossOriginIsolated: true,
    });

    expect(evidence.target.pagesUrl).toBe('https://example.test/app/');
    expect(evidence.observations.errors[0].message).not.toContain('/private/example');
    expect(evidence.observations.errors[0].message).not.toContain('secret');
    expect(redactUrl('https://example.test/app/?access_token=secret')).toBe(
      'https://example.test/app/',
    );
    expect(redactError('file:///tmp/secret.txt')).not.toContain('/tmp/secret.txt');
  });

  it('ignores only the expected favicon 404 and retains other resource failures', () => {
    expect(isExpectedResourceFailure(404, 'https://example.test/app/favicon.ico')).toBe(true);
    expect(isExpectedResourceFailure(404, 'https://example.test/app/missing-module.js')).toBe(
      false,
    );
    expect(isExpectedResourceFailure(500, 'https://example.test/app/favicon.ico')).toBe(false);
    expect(
      isGenericResourceConsoleError(
        'Failed to load resource: the server responded with a status of 404 ()',
      ),
    ).toBe(true);
    expect(isGenericResourceConsoleError('Uncaught Error: application failed')).toBe(false);
  });

  it('retains the redacted URL for a non-ignorable resource failure', () => {
    const evidence = createAcceptanceEvidence({
      actions: [],
      artifacts: [],
      browserVersion: '149.0',
      capabilities: '',
      errors: [
        {
          source: 'resource',
          message: 'Resource returned HTTP 404.',
          url: 'https://example.test/app/missing.js?token=secret',
        },
      ],
      scenario: 'capability-loop',
      serviceWorkerControlled: true,
      targetCommit: 'abc123',
      targetUrl: 'https://example.test/app/',
      crossOriginIsolated: true,
    });

    expect(evidence.observations.errors).toEqual([
      {
        source: 'resource',
        message: 'Resource returned HTTP 404.',
        url: 'https://example.test/app/missing.js',
      },
    ]);
  });
});
