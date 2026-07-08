import type { Card, CardType } from '@/types';
import { CARD_TYPE_LIST } from '@/lib/tokens';
import { nowISO } from '@/lib/format';
import { stringifyDoc, parseDoc } from './frontmatter';

export function cardPath(id: string): string {
  return `cards/${id}.md`;
}

export function cardIdFromPath(path: string): string {
  return path.replace(/^cards\//, '').replace(/\.md$/, '');
}

function asType(v: unknown): CardType {
  return CARD_TYPE_LIST.includes(v as CardType) ? (v as CardType) : 'idea';
}

function asTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export function serializeCard(c: Card): string {
  // positions live in board placements now — the card file only holds content.
  const data: Record<string, unknown> = {
    id: c.id,
    type: c.type,
    title: c.title,
    tags: c.tags,
    created: c.created,
    updated: c.updated,
  };
  return stringifyDoc(data, c.body);
}

export function parseCard(text: string, fallbackId: string): Card {
  const { data, body } = parseDoc(text);
  const ts = nowISO();
  const card: Card = {
    id: String(data.id ?? fallbackId),
    type: asType(data.type),
    title: String(data.title ?? '').trim() || '(無標題)',
    body,
    tags: asTags(data.tags),
    created: String(data.created ?? ts),
    updated: String(data.updated ?? ts),
  };
  // legacy x/y from older card files — kept only so migration can seed a board
  if (Number.isFinite(data.x)) card.x = Number(data.x);
  if (Number.isFinite(data.y)) card.y = Number(data.y);
  return card;
}
