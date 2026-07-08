import type { Conflict, ConflictKind, ConflictResolution } from '@/types';
import {
  type FileMap,
  LINKS_PATH,
  parseCard,
  serializeCard,
  parseProject,
  serializeProject,
  parseDiary,
  serializeDiary,
  parseBoard,
  serializeBoard,
  cardIdFromPath,
  cardPath,
  projectIdFromPath,
  projectPath,
  diaryDateFromPath,
  boardIdFromPath,
  boardPath,
} from '@/serialization';
import { ulid, shortId } from '@/lib/ulid';

function kindOf(path: string): ConflictKind {
  if (path.startsWith('cards/')) return 'card';
  if (path.startsWith('projects/')) return 'project';
  if (path.startsWith('diary/')) return 'diary';
  if (path.startsWith('boards/')) return 'board';
  return 'link';
}

function lineSet(s?: string): Set<string> {
  return new Set((s ?? '').split('\n').map((l) => l.trim()).filter(Boolean));
}

/**
 * Three-way set merge for the line-oriented links file. Each line is independent,
 * so this never conflicts: a line is kept unless exactly one side removed it
 * relative to the base (baseline-aware — a naive union would resurrect deletions).
 */
export function mergeNdjsonSet(base?: string, ours?: string, theirs?: string): string {
  const B = lineSet(base);
  const O = lineSet(ours);
  const T = lineSet(theirs);
  const all = new Set([...B, ...O, ...T]);
  const out: string[] = [];
  for (const l of all) {
    const inB = B.has(l);
    const inO = O.has(l);
    const inT = T.has(l);
    const present = inO === inT ? inO : inO !== inB ? inO : inT;
    if (present) out.push(l);
  }
  out.sort((x, y) => x.localeCompare(y));
  return out.join('\n') + (out.length ? '\n' : '');
}

export interface MergeResult {
  merged: FileMap;
  conflicts: Conflict[];
}

/**
 * base = content at last sync, ours = local now, theirs = remote now.
 * Auto-resolves anything only one side changed; surfaces genuine both-sides-changed
 * differences as conflicts (never silently overwrites).
 */
export function threeWayMerge(base: FileMap, ours: FileMap, theirs: FileMap): MergeResult {
  const merged: FileMap = {};
  const conflicts: Conflict[] = [];
  const paths = new Set([
    ...Object.keys(base),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ]);
  for (const path of paths) {
    const b = base[path];
    const o = ours[path];
    const t = theirs[path];
    if (path === LINKS_PATH) {
      merged[path] = mergeNdjsonSet(b, o, t);
      continue;
    }
    if (o === t) {
      if (o !== undefined) merged[path] = o;
      continue;
    }
    if (o === b) {
      if (t !== undefined) merged[path] = t; // only remote changed
      continue;
    }
    if (t === b) {
      if (o !== undefined) merged[path] = o; // only local changed
      continue;
    }
    // both sides changed differently → real conflict
    conflicts.push({ path, kind: kindOf(path), ours: o ?? '', theirs: t ?? '', base: b });
    if (o !== undefined) merged[path] = o; // tentative; resolution overwrites
  }
  return { merged, conflicts };
}

/** make a "keep-both" duplicate file from the remote version with a fresh id */
function duplicate(path: string, theirsContent: string): { path: string; content: string } | null {
  const kind = kindOf(path);
  try {
    if (kind === 'card') {
      const card = parseCard(theirsContent, cardIdFromPath(path));
      const id = ulid();
      const dup = { ...card, id, title: `${card.title} (衝突複本)` };
      return { path: cardPath(id), content: serializeCard(dup) };
    }
    if (kind === 'project') {
      const proj = parseProject(theirsContent, projectIdFromPath(path));
      const id = shortId('p');
      return { path: projectPath(id), content: serializeProject({ ...proj, id, name: `${proj.name} (衝突)` }) };
    }
    if (kind === 'board') {
      const board = parseBoard(theirsContent, boardIdFromPath(path));
      const id = shortId('b');
      return { path: boardPath(id), content: serializeBoard({ ...board, id, name: `${board.name} (衝突)` }) };
    }
    if (kind === 'diary') {
      const date = diaryDateFromPath(path);
      const entry = parseDiary(theirsContent, date);
      // append the remote text into a separate dated file suffix
      const altDate = `${date}-conflict`;
      return { path: `diary/${altDate}.md`, content: serializeDiary({ ...entry, date: altDate }) };
    }
  } catch {
    return null;
  }
  return null;
}

/** apply the user's conflict choices on top of the auto-merged map */
export function applyResolutions(
  autoMerged: FileMap,
  resolutions: ConflictResolution[],
  ours: FileMap,
  theirs: FileMap,
): FileMap {
  const out: FileMap = { ...autoMerged };
  for (const r of resolutions) {
    const { path } = r;
    if (r.choice === 'ours') {
      if (ours[path] !== undefined) out[path] = ours[path];
      else delete out[path];
    } else if (r.choice === 'theirs') {
      if (theirs[path] !== undefined) out[path] = theirs[path];
      else delete out[path];
    } else {
      // keep-both: keep ours, materialise theirs as a fresh duplicate file
      if (ours[path] !== undefined) out[path] = ours[path];
      else delete out[path];
      if (theirs[path] !== undefined) {
        const dup = duplicate(path, theirs[path]);
        if (dup) out[dup.path] = dup.content;
      }
    }
  }
  return out;
}
