import { describe, expect, it } from 'vitest';
import { isOwnedPath } from '@/sync/syncEngine';

/**
 * 檔案歸屬是資料安全的邊界，不只是內部細節：
 * syncEngine 的 buildChanges 會刪掉「app 擁有、但本機序列化結果裡沒有」的遠端檔案。
 * 所以任何 app 不會序列化出來的路徑，都必須被判定為「非擁有」，否則下一次同步就會清掉它。
 */
describe('isOwnedPath', () => {
  it('認得 app 自己序列化的所有路徑', () => {
    for (const p of [
      'cardnote.json',
      'links.ndjson',
      'cards/01J0.md',
      'boards/b1.json',
      'projects/p1.json',
      'diary/2026-08-19.md',
    ]) {
      expect(isOwnedPath(p), p).toBe(true);
    }
  });

  it('inbox/ 草稿不屬於 app——否則同步會把語音筆記整批刪掉', () => {
    expect(isOwnedPath('inbox/2026-08-19-143205.md')).toBe(false);
    expect(isOwnedPath('inbox/nested/note.md')).toBe(false);
  });

  it('repo 內其他檔案一律不碰', () => {
    for (const p of ['README.md', 'LICENSE', '.github/workflows/deploy.yml', 'reports/digest-2026-08-19.md']) {
      expect(isOwnedPath(p), p).toBe(false);
    }
  });

  it('只是名字開頭像而已的路徑不算擁有', () => {
    expect(isOwnedPath('cards-backup/01J0.md')).toBe(false);
    expect(isOwnedPath('archive/cards/01J0.md')).toBe(false);
    expect(isOwnedPath('cardnote.json.bak')).toBe(false);
  });
});
