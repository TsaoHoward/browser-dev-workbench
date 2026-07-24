import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkRegistry,
  createRegistry,
  validateWorkItemGraph,
  writeRegistry,
} from './work-item-registry.mjs';

const projectRoot = process.cwd();
const temporaryRoots = [];

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'work-item-registry-'));
  temporaryRoots.push(root);
  cpSync(join(projectRoot, 'AGENTS.md'), join(root, 'AGENTS.md'));
  cpSync(join(projectRoot, 'docs'), join(root, 'docs'), { recursive: true });
  return root;
}

function readFile(path) {
  return readFileSync(path, 'utf8');
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { force: true, recursive: true });
  }
});

describe('work-item registry', () => {
  it('derives the checked-in registry from the active discovery chain', () => {
    const graph = validateWorkItemGraph(projectRoot);

    expect(graph).toMatchObject({
      activeSlicePath: 'docs/slices/active/08-versioned-work-item-traceability.md',
      issueId: 'ISSUE-0011',
      projection: 'pending',
      requirementId: 'REQ-0801',
    });
    expect(createRegistry(graph)).toContain(graph.marker);
    expect(() => checkRegistry(projectRoot)).not.toThrow();
  });

  it('rejects a missing reciprocal requirement link', () => {
    const root = fixtureRoot();
    const requirementPath = join(
      root,
      'docs/work-items/requirements/REQ-0801-versioned-work-item-traceability.md',
    );
    writeFileSync(
      requirementPath,
      readFile(requirementPath).replace(
        '[Slice 08](../../slices/active/08-versioned-work-item-traceability.md)',
        'Slice 08',
      ),
    );

    expect(() => validateWorkItemGraph(root)).toThrow('Slice must link to');
  });

  it('rejects an unknown projection state', () => {
    const root = fixtureRoot();
    const issuePath = join(
      root,
      'docs/work-items/issues/ISSUE-0011-governance-versioned-work-item-traceability.md',
    );
    writeFileSync(
      issuePath,
      readFile(issuePath).replace(/(\|\s*Projection\s*\|\s*)pending\s*\|/, '$1lost |'),
    );

    expect(() => validateWorkItemGraph(root)).toThrow('Projection must be pending or projected');
  });

  it('detects a stale generated registry and can regenerate it', () => {
    const root = fixtureRoot();
    const registry = join(root, 'docs/work-items/registry.md');
    writeFileSync(registry, '# stale\n');

    expect(() => checkRegistry(root)).toThrow('registry.md is stale');
    writeRegistry(root);
    expect(() => checkRegistry(root)).not.toThrow();
  });
});
