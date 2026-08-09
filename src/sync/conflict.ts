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

/** three-way scalar: 單側修改自動採用；兩側改成不同值 → null（真衝突） */
function mergeScalar<T>(base: T, ours: T, theirs: T): { value: T } | null {
  if (ours === theirs) return { value: ours };
  if (ours === base) return { value: theirs };
  if (theirs === base) return { value: ours };
  return null;
}

/** three-way 集合成員資格：一個成員只有在「恰好一側相對 base 移除它」時才消失 */
function memberPresent(inB: boolean, inO: boolean, inT: boolean): boolean {
  return inO === inT ? inO : inO !== inB ? inO : inT;
}

/**
 * 卡片欄位級三方合併：A 改內文、B 改標籤不再是整檔衝突。
 * type/title/body 逐欄位 three-way；tags 做集合合併（保序：ours 順序優先）；
 * updated 取較新。同一欄位兩側改成不同值才回傳 null（升級成整檔衝突）。
 */
export function mergeCardFiles(base: string | undefined, ours: string, theirs: string): string | null {
  const id = 'merge-tmp';
  const b = base !== undefined ? parseCard(base, id) : null;
  const o = parseCard(ours, id);
  const t = parseCard(theirs, id);
  if (o.id !== t.id) return null; // 不同卡落在同一路徑——不該發生，交給整檔衝突

  const type = mergeScalar(b?.type, o.type, t.type);
  const title = mergeScalar(b?.title, o.title, t.title);
  const body = mergeScalar(b?.body, o.body, t.body);
  if (!type || !title || !body) return null;

  const bTags = new Set(b?.tags ?? []);
  const oTags = new Set(o.tags);
  const tTags = new Set(t.tags);
  const tags = [...o.tags, ...t.tags.filter((x) => !oTags.has(x))].filter((tag) =>
    memberPresent(bTags.has(tag), oTags.has(tag), tTags.has(tag)),
  );

  return serializeCard({
    ...o,
    type: type.value!,
    title: title.value!,
    body: body.value!,
    tags,
    created: o.created < t.created ? o.created : t.created,
    updated: o.updated > t.updated ? o.updated : t.updated,
  });
}

/**
 * 白板 placement 級三方合併：A 拖卡片 1、B 拖卡片 2 不再是整檔衝突。
 * 成員資格照集合規則（單側移除才消失）；同一張卡兩側拖到不同位置時
 * 採 ours（座標是外觀狀態，不值得跳衝突視窗）。名稱兩側改成不同值 → null。
 */
export function mergeBoardFiles(base: string | undefined, ours: string, theirs: string): string | null {
  const id = 'merge-tmp';
  const b = base !== undefined ? parseBoard(base, id) : null;
  const o = parseBoard(ours, id);
  const t = parseBoard(theirs, id);
  if (o.id !== t.id) return null;

  const name = mergeScalar(b?.name, o.name, t.name);
  if (!name) return null;

  const bIds = new Set((b?.placements ?? []).map((p) => p.cardId));
  const oById = new Map(o.placements.map((p) => [p.cardId, p]));
  const tById = new Map(t.placements.map((p) => [p.cardId, p]));
  const order = [...o.placements.map((p) => p.cardId), ...t.placements.map((p) => p.cardId).filter((c) => !oById.has(c))];

  const placements = order
    .filter((cardId) => memberPresent(bIds.has(cardId), oById.has(cardId), tById.has(cardId)))
    .map((cardId) => {
      const op = oById.get(cardId);
      const tp = tById.get(cardId);
      if (op && tp) {
        const bp = b?.placements.find((p) => p.cardId === cardId);
        // 只有遠端動過（本機位置還在 base）→ 採遠端；其餘（含兩側都動）採本機
        const oursUnmoved = bp !== undefined && bp.x === op.x && bp.y === op.y;
        return oursUnmoved ? tp : op;
      }
      return (op ?? tp)!;
    });

  return serializeBoard({ id: o.id, name: name.value!, placements });
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
    // both sides changed → try structured (field/placement-level) merge first
    if (o !== undefined && t !== undefined) {
      const structured =
        kindOf(path) === 'card'
          ? mergeCardFiles(b, o, t)
          : kindOf(path) === 'board'
            ? mergeBoardFiles(b, o, t)
            : null;
      if (structured !== null) {
        merged[path] = structured;
        continue;
      }
    }
    // genuinely irreconcilable → real conflict
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
