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
      x: coord(rec.x),
      y: coord(rec.y),
    });
  }
  return out;
}

/**
 * A usable board order: a number that survives JSON round-tripping unchanged.
 * Beyond MAX_SAFE_INTEGER, JSON.parse silently snaps to a different value, so
 * re-serializing would rewrite a board file the user never touched — and iOS
 * (64-bit Int) would not snap the same way, breaking byte-level parity.
 */
function isValidOrder(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(Math.round(v));
}

/**
 * A placement coordinate we can write out. Anything that doesn't round to a
 * safe integer (±Infinity, 1e100, NaN) becomes 0: iOS rounds coordinates into
 * a 64-bit Int, and a value past that range traps there rather than returning
 * nil, so writing one out would crash the other client.
 */
function coord(v: unknown): number {
  return typeof v === 'number' && Number.isSafeInteger(Math.round(v)) ? Number(v) : 0;
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
    ...(isValidOrder(b.order) ? { order: Math.round(b.order) } : {}),
    ...(b.archived ? { archived: true } : {}),
    placements: b.placements.map((p) => ({
      cardId: p.cardId,
      x: Math.round(coord(p.x)),
      y: Math.round(coord(p.y)),
    })),
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
  if (isValidOrder(raw.order)) board.order = Math.round(raw.order);
  if (raw.archived === true) board.archived = true;
  return board;
}
