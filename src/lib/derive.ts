import type { Board, Card, CardType, Link } from '@/types';
import { CARD_TYPES } from './tokens';

export interface EnrichedCard extends Card {
  color: string;
  tint: string;
  typeLabel: string;
  linkCount: number;
  hasLinks: boolean;
}

/** attach type token + solid-link count to a card for rendering */
export function enrichCard(card: Card, links: Link[]): EnrichedCard {
  const t = CARD_TYPES[card.type] ?? CARD_TYPES.idea;
  const solid = links.filter(
    (l) => l.type === 'solid' && (l.a === card.id || l.b === card.id),
  );
  return {
    ...card,
    color: t.color,
    tint: t.tint,
    typeLabel: t.label,
    linkCount: solid.length,
    hasLinks: solid.length > 0,
  };
}

/** canonical key for an undirected link, ignoring direction */
export function linkKey(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export function otherEnd(link: Link, id: string): string {
  return link.a === id ? link.b : link.a;
}

export interface PlacedCard {
  card: Card;
  x: number;
  y: number;
}

/** resolve a board's placements into cards + the links that connect placed cards */
export function boardView(board: Board | null, cards: Card[], links: Link[]): {
  placed: PlacedCard[];
  boardLinks: Link[];
} {
  if (!board) return { placed: [], boardLinks: [] };
  const byId = new Map(cards.map((c) => [c.id, c]));
  const placed: PlacedCard[] = [];
  for (const p of board.placements) {
    const card = byId.get(p.cardId);
    if (card) placed.push({ card, x: p.x, y: p.y });
  }
  const ids = new Set(placed.map((p) => p.card.id));
  const boardLinks = links.filter((l) => ids.has(l.a) && ids.has(l.b));
  return { placed, boardLinks };
}

/** infer a card type from free text (used when a source has no type) */
export function inferType(text: string): CardType {
  const t = text.toLowerCase();
  if (/(okr|目標|kpi|kr\d|target)/.test(t)) return 'okr';
  if (/(訪談|interview|客戶|受訪|user research|使用者研究)/.test(t)) return 'research';
  if (/(競品|competitor|competit|對手|notion|市場)/.test(t)) return 'compete';
  if (/(會議|週會|meeting|決議|站會|sync)/.test(t)) return 'meeting';
  if (/(設計|design|互動|體驗|ux|ui)/.test(t)) return 'design';
  if (/(技術|架構|api|實作|程式|code|sync|資料庫|git)/.test(t)) return 'tech';
  return 'idea';
}
