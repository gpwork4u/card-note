import type { CardType, DiaryEntry, DiaryExtract } from '@/types';
import { CARD_TYPE_LIST } from '@/lib/tokens';
import { stringifyDoc, parseDoc } from './frontmatter';

export function diaryPath(date: string): string {
  return `diary/${date}.md`;
}

export function diaryDateFromPath(path: string): string {
  return path.replace(/^diary\//, '').replace(/\.md$/, '');
}

function asExtracted(v: unknown): DiaryExtract[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e: any) => {
      if (!e || typeof e !== 'object') return null;
      const type = CARD_TYPE_LIST.includes(e.type) ? (e.type as CardType) : 'idea';
      const title = String(e.title ?? '').trim();
      if (!title) return null;
      const out: DiaryExtract = { title, type };
      if (e.id) out.id = String(e.id);
      return out;
    })
    .filter((x): x is DiaryExtract => x !== null);
}

export function serializeDiary(d: DiaryEntry): string {
  const data: Record<string, unknown> = {
    date: d.date,
    processed: d.processed,
  };
  if (d.extracted.length) {
    data.extracted = d.extracted.map((e) => ({
      ...(e.id ? { id: e.id } : {}),
      title: e.title,
      type: e.type,
    }));
  }
  return stringifyDoc(data, d.text);
}

export function parseDiary(text: string, fallbackDate: string): DiaryEntry {
  const { data, body } = parseDoc(text);
  return {
    id: 'd' + (data.date ?? fallbackDate),
    date: String(data.date ?? fallbackDate),
    processed: Boolean(data.processed),
    text: body,
    extracted: asExtracted(data.extracted),
  };
}
