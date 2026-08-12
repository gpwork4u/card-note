import { describe, it, expect } from 'vitest';
import { threeWayMerge, mergeCardFiles, mergeBoardFiles } from '@/sync/conflict';
import { serializeCard, parseCard, serializeBoard, parseBoard, cardPath, boardPath } from '@/serialization';
import type { Card, Board } from '@/types';

const baseCard: Card = {
  id: '01TESTCARD',
  type: 'idea',
  title: '原標題',
  body: '原內文',
  tags: ['a', 'b'],
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
};

function cardFile(patch: Partial<Card>): string {
  return serializeCard({ ...baseCard, ...patch });
}

const baseBoard: Board = {
  id: 'b1',
  name: '白板',
  placements: [
    { cardId: 'c1', x: 100, y: 100 },
    { cardId: 'c2', x: 200, y: 200 },
  ],
};

function boardFile(patch: Partial<Board>): string {
  return serializeBoard({ ...baseBoard, ...patch });
}

describe('mergeCardFiles（欄位級三方合併）', () => {
  it('一側改內文、另一側改標籤 → 兩者都保留，不衝突', () => {
    const merged = mergeCardFiles(
      cardFile({}),
      cardFile({ body: '新內文', updated: '2026-01-02T00:00:00Z' }),
      cardFile({ tags: ['a', 'b', 'c'], updated: '2026-01-03T00:00:00Z' }),
    );
    expect(merged).not.toBeNull();
    const card = parseCard(merged!, 'x');
    expect(card.body).toBe('新內文');
    expect(card.tags).toEqual(['a', 'b', 'c']);
    expect(card.updated).toBe('2026-01-03T00:00:00Z'); // 取較新
  });

  it('兩側把內文改成不同值 → null（升級整檔衝突）', () => {
    const merged = mergeCardFiles(cardFile({}), cardFile({ body: 'A 版' }), cardFile({ body: 'B 版' }));
    expect(merged).toBeNull();
  });

  it('標籤刪除不被另一側復活', () => {
    const merged = mergeCardFiles(
      cardFile({}),
      cardFile({ tags: ['a'] }), // 本機刪了 b
      cardFile({ tags: ['a', 'b', 'c'] }), // 遠端加了 c
    );
    expect(parseCard(merged!, 'x').tags).toEqual(['a', 'c']);
  });

  it('title 與 type 各改一側 → 都採用', () => {
    const merged = mergeCardFiles(
      cardFile({}),
      cardFile({ title: '新標題' }),
      cardFile({ type: 'tech' }),
    );
    const card = parseCard(merged!, 'x');
    expect(card.title).toBe('新標題');
    expect(card.type).toBe('tech');
  });
});

describe('mergeBoardFiles（placement 級三方合併）', () => {
  it('兩側各拖不同卡片 → 兩個新位置都保留，不衝突', () => {
    const merged = mergeBoardFiles(
      boardFile({}),
      boardFile({ placements: [{ cardId: 'c1', x: 500, y: 500 }, { cardId: 'c2', x: 200, y: 200 }] }),
      boardFile({ placements: [{ cardId: 'c1', x: 100, y: 100 }, { cardId: 'c2', x: 700, y: 700 }] }),
    );
    expect(merged).not.toBeNull();
    const board = parseBoard(merged!, 'x');
    expect(board.placements.find((p) => p.cardId === 'c1')).toMatchObject({ x: 500, y: 500 });
    expect(board.placements.find((p) => p.cardId === 'c2')).toMatchObject({ x: 700, y: 700 });
  });

  it('同一張卡兩側都拖 → 採本機（座標不跳衝突）', () => {
    const merged = mergeBoardFiles(
      boardFile({}),
      boardFile({ placements: [{ cardId: 'c1', x: 500, y: 500 }, { cardId: 'c2', x: 200, y: 200 }] }),
      boardFile({ placements: [{ cardId: 'c1', x: 900, y: 900 }, { cardId: 'c2', x: 200, y: 200 }] }),
    );
    expect(parseBoard(merged!, 'x').placements.find((p) => p.cardId === 'c1')).toMatchObject({ x: 500, y: 500 });
  });

  it('一側移除卡片、另一側沒動 → 移除生效；一側新增 → 保留', () => {
    const merged = mergeBoardFiles(
      boardFile({}),
      boardFile({ placements: [{ cardId: 'c1', x: 100, y: 100 }] }), // 本機移除 c2
      boardFile({ placements: [...baseBoard.placements, { cardId: 'c3', x: 300, y: 300 }] }), // 遠端加 c3
    );
    const ids = parseBoard(merged!, 'x').placements.map((p) => p.cardId);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
    expect(ids).not.toContain('c2');
  });

  it('兩側把白板改成不同名稱 → null（真衝突）', () => {
    const merged = mergeBoardFiles(boardFile({}), boardFile({ name: 'A 名' }), boardFile({ name: 'B 名' }));
    expect(merged).toBeNull();
  });
});

describe('threeWayMerge 整合結構化合併', () => {
  it('卡片欄位級可合併時不再產生衝突', () => {
    const base = { [cardPath(baseCard.id)]: cardFile({}) };
    const ours = { [cardPath(baseCard.id)]: cardFile({ body: '新內文' }) };
    const theirs = { [cardPath(baseCard.id)]: cardFile({ tags: ['a', 'b', 'z'] }) };
    const { merged, conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toHaveLength(0);
    const card = parseCard(merged[cardPath(baseCard.id)], 'x');
    expect(card.body).toBe('新內文');
    expect(card.tags).toContain('z');
  });

  it('白板兩側拖不同卡片時不再產生衝突', () => {
    const base = { [boardPath('b1')]: boardFile({}) };
    const ours = { [boardPath('b1')]: boardFile({ placements: [{ cardId: 'c1', x: 9, y: 9 }, { cardId: 'c2', x: 200, y: 200 }] }) };
    const theirs = { [boardPath('b1')]: boardFile({ placements: [{ cardId: 'c1', x: 100, y: 100 }, { cardId: 'c2', x: 8, y: 8 }] }) };
    const { conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toHaveLength(0);
  });

  it('真正不可調和（同欄位雙改）仍然是衝突', () => {
    const base = { [cardPath(baseCard.id)]: cardFile({}) };
    const ours = { [cardPath(baseCard.id)]: cardFile({ body: 'A 版' }) };
    const theirs = { [cardPath(baseCard.id)]: cardFile({ body: 'B 版' }) };
    const { conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toHaveLength(1);
  });

  it('一側刪檔、一側編輯 → 仍是衝突（不自動選邊）', () => {
    const base = { [cardPath(baseCard.id)]: cardFile({}) };
    const ours = {};
    const theirs = { [cardPath(baseCard.id)]: cardFile({ body: '編輯過' }) };
    const { conflicts } = threeWayMerge(base, ours, theirs);
    expect(conflicts).toHaveLength(1);
  });
});

describe('同步期間編輯的 rebase 語意（adoptSyncResult 核心）', () => {
  it('base=同步開始、ours=當下編輯、theirs=同步結果 → 編輯保留、遠端新卡不丟', () => {
    const syncStart = { [cardPath(baseCard.id)]: cardFile({}) };
    const current = { [cardPath(baseCard.id)]: cardFile({ body: '同步期間的編輯' }) };
    const merged = {
      [cardPath(baseCard.id)]: cardFile({}),
      'cards/01REMOTENEW.md': cardFile({ id: '01REMOTENEW', title: '遠端新卡' } as never),
    };
    const final = threeWayMerge(syncStart, current, merged).merged;
    expect(final[cardPath(baseCard.id)]).toContain('同步期間的編輯');
    expect(final['cards/01REMOTENEW.md']).toBeDefined();
  });

  it('同一欄位「同步期間編輯」與「同步結果」都改 → 當下編輯優先（暫定值語意）', () => {
    const syncStart = { [cardPath(baseCard.id)]: cardFile({}) };
    const current = { [cardPath(baseCard.id)]: cardFile({ body: '最新的本機編輯' }) };
    const merged = { [cardPath(baseCard.id)]: cardFile({ body: '同步進來的版本' }) };
    const final = threeWayMerge(syncStart, current, merged).merged;
    expect(final[cardPath(baseCard.id)]).toContain('最新的本機編輯');
  });
});
