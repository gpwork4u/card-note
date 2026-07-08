import { describe, expect, it } from 'vitest';
import { parseAll, serializeAll, serializeCard, parseCard, cardPath } from '@/serialization';
import type { AppData } from '@/store';
import type { Card } from '@/types';

const T = '2026-07-08T10:00:00.000Z';

function card(id: string, over: Partial<Card> = {}): Card {
  return {
    id,
    type: 'idea',
    title: '測試卡片',
    body: '內文第一行。\n\n第二段，含 **markdown** 與 `code`。',
    tags: ['測試', 'zettel'],
    created: T,
    updated: T,
    ...over,
  };
}

const data: AppData = {
  cards: [
    card('01AAAAAAAAAAAAAAAAAAAAAAAA'),
    card('01BBBBBBBBBBBBBBBBBBBBBBBB', {
      type: 'tech',
      title: '含特殊字元: "引號" --- 分隔線',
      body: '---\n看起來像 frontmatter 的內文\ntitle: 假欄位\n---',
      tags: [],
    }),
  ],
  links: [
    { a: '01AAAAAAAAAAAAAAAAAAAAAAAA', b: '01BBBBBBBBBBBBBBBBBBBBBBBB', type: 'solid' },
  ],
  projects: [
    { id: 'p1', name: '專案一', color: '#3B82F6', cols: { todo: ['01AAAAAAAAAAAAAAAAAAAAAAAA'], doing: [], done: [] } },
  ],
  diary: [
    // diary id 不寫入檔案，parse 時由日期衍生為 d<date>
    { id: 'd2026-07-08', date: '2026-07-08', processed: false, text: '今天寫了測試。', extracted: [] },
  ],
  boards: [
    { id: 'b1', name: '主白板', placements: [{ cardId: '01AAAAAAAAAAAAAAAAAAAAAAAA', x: 120, y: 240 }] },
  ],
};

describe('serializeAll / parseAll round-trip', () => {
  it('round-trips the full app data set', () => {
    const files = serializeAll(data);
    const back = parseAll(files);
    const sortCards = (d: AppData) => ({
      ...d,
      cards: [...d.cards].sort((a, b) => a.id.localeCompare(b.id)),
    });
    expect(sortCards(back)).toEqual(sortCards(data));
  });

  it('is idempotent (serialize → parse → serialize yields identical files)', () => {
    const files = serializeAll(data);
    const again = serializeAll({ ...parseAll(files) });
    expect(again).toEqual(files);
  });

  it('emits the expected file layout', () => {
    const files = serializeAll(data);
    expect(Object.keys(files).sort()).toEqual([
      'boards/b1.json',
      'cardnote.json',
      'cards/01AAAAAAAAAAAAAAAAAAAAAAAA.md',
      'cards/01BBBBBBBBBBBBBBBBBBBBBBBB.md',
      'diary/2026-07-08.md',
      'links.ndjson',
      'projects/p1.json',
    ]);
    expect(JSON.parse(files['cardnote.json'])).toEqual({ schemaVersion: 2, app: 'card-note' });
  });

  it('ignores unknown paths when parsing', () => {
    const files = serializeAll(data);
    files['README.md'] = '# not ours';
    files['assets/logo.png'] = 'binaryish';
    const back = parseAll(files);
    expect(back.cards).toHaveLength(2);
  });
});

describe('card file edge cases', () => {
  it('round-trips a body that looks like frontmatter', () => {
    const c = card('01CCCCCCCCCCCCCCCCCCCCCCCC', { body: '---\ntitle: 陷阱\n---\n真正內文' });
    const back = parseCard(serializeCard(c), c.id);
    expect(back.body).toBe(c.body);
    expect(back.title).toBe(c.title);
  });

  it('round-trips empty tags and empty body', () => {
    const c = card('01DDDDDDDDDDDDDDDDDDDDDDDD', { tags: [], body: '' });
    const back = parseCard(serializeCard(c), c.id);
    expect(back.tags).toEqual([]);
    expect(back.body).toBe('');
  });

  it('cardPath uses the card id', () => {
    expect(cardPath('01AAAAAAAAAAAAAAAAAAAAAAAA')).toBe('cards/01AAAAAAAAAAAAAAAAAAAAAAAA.md');
  });
});
