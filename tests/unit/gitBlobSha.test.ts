import { describe, expect, it } from 'vitest';
import { gitBlobSha } from '@/lib/gitBlobSha';
import { base64ToUtf8, utf8ToBase64 } from '@/lib/base64';

describe('gitBlobSha', () => {
  // expected values cross-checked with `git hash-object`
  it('matches git for the empty blob', async () => {
    expect(await gitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('matches git for "hello\\n"', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('hashes multibyte UTF-8 by byte length, not char length', async () => {
    const a = await gitBlobSha('中文內容');
    const b = await gitBlobSha('中文內容');
    const c = await gitBlobSha('中文內容!');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('base64 helpers', () => {
  it('round-trips multibyte UTF-8', () => {
    const s = '卡片盒筆記 📝 émoji\n多行';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('tolerates whitespace in GitHub blob responses', () => {
    const b64 = utf8ToBase64('hello world');
    const wrapped = b64.replace(/(.{4})/g, '$1\n');
    expect(base64ToUtf8(wrapped)).toBe('hello world');
  });
});
