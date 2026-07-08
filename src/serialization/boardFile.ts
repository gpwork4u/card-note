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

export function serializeBoard(b: Board): string {
  const obj = {
    id: b.id,
    name: b.name,
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
  return {
    id: typeof raw.id === 'string' ? raw.id : fallbackId,
    name: typeof raw.name === 'string' ? raw.name : '未命名白板',
    placements: asPlacements(raw.placements),
  };
}
