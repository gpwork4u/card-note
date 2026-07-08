import type { AppData } from '@/store';
import type { ImportReport } from '@/types';

// ---------------------------------------------------------------------------
// Heptabase All-Data.json — normalized shapes (defensive: fields may be absent)
// ---------------------------------------------------------------------------

export interface HeptaCard {
  id: string;
  title?: string;
  /** raw content — usually a JSON string (ProseMirror doc) or plain text */
  content: unknown;
  isTrashed?: boolean;
  createdTime?: unknown;
  lastEditedTime?: unknown;
  spaceId?: string;
}

export interface HeptaCardInstance {
  id: string;
  cardId: string;
  whiteboardId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  isFolded?: boolean;
}

export interface HeptaConnection {
  id: string;
  whiteboardId?: string;
  /** points at a cardInstance id (NOT a cardId) */
  beginId: string;
  endId: string;
  beginObjectType?: string;
  endObjectType?: string;
}

export interface HeptaWhiteboard {
  id: string;
  name?: string;
  isTrashed?: boolean;
}

// ---------------------------------------------------------------------------
// Primitive type guards / coercion helpers (unknown-in, narrow-out)
// ---------------------------------------------------------------------------

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/** return the first present (non null/undefined) value among the given keys */
export function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Normalizers — return null when a required field (id / endpoints) is missing
// ---------------------------------------------------------------------------

export function normalizeCard(raw: unknown): HeptaCard | null {
  if (!isRecord(raw)) return null;
  const id = asString(pick(raw, 'id'));
  if (!id) return null;
  return {
    id,
    title: asString(pick(raw, 'title', 'name')),
    content: pick(raw, 'content', 'text', 'body'),
    isTrashed: asBoolean(pick(raw, 'isTrashed', 'trashed')),
    createdTime: pick(raw, 'createdTime', 'createdAt', 'created'),
    lastEditedTime: pick(raw, 'lastEditedTime', 'updatedAt', 'lastEdited', 'editedTime'),
    spaceId: asString(pick(raw, 'spaceId')),
  };
}

export function normalizeInstance(raw: unknown): HeptaCardInstance | null {
  if (!isRecord(raw)) return null;
  const id = asString(pick(raw, 'id'));
  const cardId = asString(pick(raw, 'cardId', 'card'));
  if (!id || !cardId) return null;
  return {
    id,
    cardId,
    whiteboardId: asString(pick(raw, 'whiteboardId', 'whiteBoardId', 'boardId')) ?? '',
    x: asNumber(pick(raw, 'x')) ?? 0,
    y: asNumber(pick(raw, 'y')) ?? 0,
    width: asNumber(pick(raw, 'width')),
    height: asNumber(pick(raw, 'height')),
    color: asString(pick(raw, 'color')),
    isFolded: asBoolean(pick(raw, 'isFolded')),
  };
}

export function normalizeConnection(raw: unknown): HeptaConnection | null {
  if (!isRecord(raw)) return null;
  const beginId = asString(pick(raw, 'beginId', 'fromId', 'sourceId', 'startId'));
  const endId = asString(pick(raw, 'endId', 'toId', 'targetId'));
  if (!beginId || !endId) return null;
  return {
    id: asString(pick(raw, 'id')) ?? '',
    whiteboardId: asString(pick(raw, 'whiteboardId', 'whiteBoardId')),
    beginId,
    endId,
    beginObjectType: asString(pick(raw, 'beginObjectType')),
    endObjectType: asString(pick(raw, 'endObjectType')),
  };
}

export function normalizeWhiteboard(raw: unknown): HeptaWhiteboard | null {
  if (!isRecord(raw)) return null;
  const id = asString(pick(raw, 'id'));
  if (!id) return null;
  return {
    id,
    name: asString(pick(raw, 'name', 'title')),
    isTrashed: asBoolean(pick(raw, 'isTrashed', 'trashed')),
  };
}

/** quick guess whether a parsed value looks like a Heptabase All-Data dump */
export function hasCardList(v: unknown): boolean {
  return isRecord(v) && Array.isArray(v.cardList);
}

// ---------------------------------------------------------------------------
// Shared utilities used by both the JSON and Markdown importers
// ---------------------------------------------------------------------------

/** convert a Heptabase timestamp (ISO string or epoch number) to an ISO string */
export function toISO(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // heuristic: values below 1e12 are epoch-seconds, otherwise epoch-millis
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value.trim());
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
}

/** derive a title from an explicit title, else the first non-empty body line */
export function deriveTitle(rawTitle: string | undefined, body: string): string {
  const explicit = rawTitle?.trim();
  if (explicit) return explicit;
  const firstLine = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine) {
    const cleaned = firstLine
      .replace(/^#{1,6}\s*/, '') // strip heading markers
      .replace(/^[-*>]\s+/, '') // strip list/quote markers
      .trim();
    if (cleaned) return cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }
  return '(無標題)';
}

export function emptyReport(): ImportReport {
  return {
    cardsImported: 0,
    linksImported: 0,
    diaryImported: 0,
    instancesSkipped: 0,
    connectionsDropped: 0,
    warnings: [],
    lossyCards: [],
  };
}

export function emptyData(): AppData {
  return { cards: [], links: [], projects: [], diary: [], boards: [] };
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** last path segment of a (possibly nested) zip entry name */
export function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}
