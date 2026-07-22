import { describe, expect, it } from 'vitest';
import { shouldReplaceSnapshot } from './import-conflict';

describe('shouldReplaceSnapshot', () => {
  it('saves a first import immediately', () => {
    expect(shouldReplaceSnapshot(false, 'retain')).toBe(true);
  });

  it('makes both conflict choices explicit', () => {
    expect(shouldReplaceSnapshot(true, 'replace')).toBe(true);
    expect(shouldReplaceSnapshot(true, 'retain')).toBe(false);
  });
});
