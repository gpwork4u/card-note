import type { Board, Placement } from '@/types';

export function boardPath(id: string): string {
  return `boards/${id}.json`;
}

export function boardIdFromPath(path: string): string {
  return path.replace(/^boards\//, '').replace(/\.json$/, '');
}

function asPlacements(v: unknown): Placement[] {
  if (!Array.isArray(v)) return [];
  const out: Placement[] = [];
  for (const p of v) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as Record<string, unknown>;
    const cardId = rec.cardId;
    if (typeof cardId !== 'string' || !cardId) continue;
    out.push({
      cardId,
      x: Number.isFinite(rec.x) ? Number(rec.x) : 0,
      y: Number.isFinite(rec.y) ? Number(rec.y) : 0,
    });
  }
  return out;
}

/**
 * `order` and `archived` are written only when they carry information: a board
 * that has never been reordered or archived serializes exactly as it did before
 * those fields existed, so adding this feature does not rewrite every board file
 * in the data repo (and does not fight the iOS client over untouched bytes).
 */
export function serializeBoard(b: Board): string {
  const obj = {
    id: b.id,
    name: b.name,
    ...(typeof b.order === 'number' && Number.isFinite(b.order) ? { order: Math.round(b.order) } : {}),
    ...(b.archived ? { archived: true } : {}),
    placements: b.placements.map((p) => ({ cardId: p.cardId, x: Math.round(p.x), y: Math.round(p.y) })),
  };
  return JSON.stringify(obj, null, 2) + '\n';
}

export function parseBoard(text: string, fallbackId: string): Board {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(text);
  } catch {
    raw = {};
  }
  const board: Board = {
    id: typeof raw.id === 'string' ? raw.id : fallbackId,
    name: typeof raw.name === 'string' ? raw.name : '未命名白板',
    placements: asPlacements(raw.placements),
  };
  if (typeof raw.order === 'number' && Number.isFinite(raw.order)) board.order = Math.round(raw.order);
  if (raw.archived === true) board.archived = true;
  return board;
}
