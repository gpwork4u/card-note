import { describe, expect, it } from 'vitest';
import { applyResolutions, mergeNdjsonSet, threeWayMerge } from '@/sync/conflict';
import { parseCard, serializeCard } from '@/serialization';
import type { Card } from '@/types';
import type { FileMap } from '@/serialization';

const T = '2026-07-08T10:00:00.000Z';

function cardContent(id: string, title: string): string {
  const c: Card = { id, type: 'idea', title, body: '內文', tags: [], created: T, updated: T };
  return serializeCard(c);
}

const P = 'cards/01AAAAAAAAAAAAAAAAAAAAAAAA.md';

describe('threeWayMerge', () => {
  it('keeps identical content untouched', () => {
    const f: FileMap = { [P]: cardContent('01AAAAAAAAAAAAAAAAAAAAAAAA', '原始') };
    const { merged, conflicts } = threeWayMerge(f, f, f);
    expect(conflicts).toEqual([]);
    expect(merged).toEqual(f);
  });

  it('takes theirs when only remote changed', () => {
    const base: FileMap = { [P]: 'v1' };
    const { merged, conflicts } = threeWayMerge(base, { [P]: 'v1' }, { [P]: 'v2' });
    expect(conflicts).toEqual([]);
    expect(merged[P]).toBe('v2');
  });

  it('takes ours when only local changed', () => {
    const base: FileMap = { [P]: 'v1' };
    const { merged, conflicts } = threeWayMerge(base, { [P]: 'v2' }, { [P]: 'v1' });
    expect(conflicts).toEqual([]);
    expect(merged[P]).toBe('v2');
  });

  it('propagates a remote deletion when local is unchanged', () => {
    const base: FileMap = { [P]: 'v1' };
    const { merged, conflicts } = threeWayMerge(base, { [P]: 'v1' }, {});
    expect(conflicts).toEqual([]);
    expect(merged[P]).toBeUndefined();
  });

  it('adds files created on either side', () => {
    const { merged, conflicts } = threeWayMerge({}, { 'cards/a.md': 'A' }, { 'cards/b.md': 'B' });
    expect(conflicts).toEqual([]);
    expect(merged).toEqual({ 'cards/a.md': 'A', 'cards/b.md': 'B' });
  });

  it('flags a conflict when both sides changed differently', () => {
    const base: FileMap = { [P]: 'v1' };
    const { conflicts } = threeWayMerge(base, { [P]: 'ours' }, { [P]: 'theirs' });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ path: P, kind: 'card', ours: 'ours', theirs: 'theirs' });
  });
});

describe('mergeNdjsonSet (links)', () => {
  const l1 = '{"a":"1","b":"2","type":"solid"}';
  const l2 = '{"a":"1","b":"3","type":"solid"}';
  const l3 = '{"a":"2","b":"3","type":"solid"}';

  it('unions additions from both sides', () => {
    const out = mergeNdjsonSet(l1 + '\n', l1 + '\n' + l2 + '\n', l1 + '\n' + l3 + '\n');
    expect(out.trim().split('\n').sort()).toEqual([l1, l2, l3].sort());
  });

  it('does not resurrect a line one side deleted', () => {
    const out = mergeNdjsonSet(l1 + '\n' + l2 + '\n', l2 + '\n', l1 + '\n' + l2 + '\n');
    expect(out).toBe(l2 + '\n');
  });

  it('never conflicts on simultaneous edits', () => {
    const out = mergeNdjsonSet(undefined, l1 + '\n', l2 + '\n');
    expect(out.trim().split('\n').sort()).toEqual([l1, l2].sort());
  });
});

describe('applyResolutions', () => {
  const ours: FileMap = { [P]: cardContent('01AAAAAAAAAAAAAAAAAAAAAAAA', '我方版本') };
  const theirs: FileMap = { [P]: cardContent('01AAAAAAAAAAAAAAAAAAAAAAAA', '對方版本') };

  it('choice=ours keeps our file', () => {
    const out = applyResolutions({ ...ours }, [{ path: P, choice: 'ours' }], ours, theirs);
    expect(out[P]).toBe(ours[P]);
  });

  it('choice=theirs takes the remote file', () => {
    const out = applyResolutions({ ...ours }, [{ path: P, choice: 'theirs' }], ours, theirs);
    expect(out[P]).toBe(theirs[P]);
  });

  it('choice=keep-both keeps ours and duplicates theirs under a fresh id', () => {
    const out = applyResolutions({ ...ours }, [{ path: P, choice: 'keep-both' }], ours, theirs);
    expect(out[P]).toBe(ours[P]);
    const dupPath = Object.keys(out).find((p) => p !== P);
    expect(dupPath).toBeDefined();
    const dup = parseCard(out[dupPath!], dupPath!.replace(/^cards\//, '').replace(/\.md$/, ''));
    expect(dup.title).toBe('對方版本 (衝突複本)');
    expect(dup.id).not.toBe('01AAAAAAAAAAAAAAAAAAAAAAAA');
  });
});
