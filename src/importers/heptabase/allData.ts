import type { AppData } from '@/store';
import type { Board, Card, ImportReport, Link, Placement } from '@/types';
import { inferType, linkKey } from '@/lib/derive';
import { HEPTA_COLOR_TO_TYPE } from '@/lib/tokens';
import { contentToMarkdown, type ConvertCtx } from './prosemirror';
import {
  asArray,
  deriveTitle,
  emptyData,
  emptyReport,
  errMsg,
  isRecord,
  normalizeCard,
  normalizeConnection,
  normalizeInstance,
  normalizeWhiteboard,
  pick,
  toISO,
  type HeptaCardInstance,
} from './schema';

/**
 * Parse a Heptabase `All-Data.json` document (as text) into AppData + report.
 * Never throws: individual card failures are skipped and recorded as warnings.
 */
export function importAllData(jsonText: string): { data: AppData; report: ImportReport } {
  const report = emptyReport();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    report.warnings.push(`JSON 解析失敗: ${errMsg(e)}`);
    return { data: emptyData(), report };
  }
  if (!isRecord(parsed)) {
    report.warnings.push('JSON 頂層不是物件，無法匯入');
    return { data: emptyData(), report };
  }

  try {
    return mapAllData(parsed, report);
  } catch (e) {
    report.warnings.push(`匯入過程發生未預期錯誤: ${errMsg(e)}`);
    return { data: { cards: [], links: [], projects: [], diary: [], boards: [] }, report };
  }
}

function mapAllData(
  root: Record<string, unknown>,
  report: ImportReport,
): { data: AppData; report: ImportReport } {
  const rawCards = asArray(pick(root, 'cardList', 'cards'));
  const rawWhiteboards = asArray(pick(root, 'whiteBoardList', 'whiteboardList', 'whiteboards'));
  const rawInstances = asArray(pick(root, 'cardInstances', 'instances'));
  const rawConnections = asArray(pick(root, 'connections', 'connectionList'));

  // ---- whiteboards: every non-trashed whiteboard becomes a Board ----
  const trashedBoards = new Set<string>();
  const boards: Board[] = [];
  const boardById = new Map<string, Board>();
  for (const raw of rawWhiteboards) {
    const wb = normalizeWhiteboard(raw);
    if (!wb) continue;
    if (wb.isTrashed) {
      trashedBoards.add(wb.id);
      continue;
    }
    if (boardById.has(wb.id)) continue; // ignore duplicate board ids
    const board: Board = { id: wb.id, name: wb.name?.trim() || '未命名白板', placements: [] };
    boards.push(board);
    boardById.set(wb.id, board);
  }

  // ---- instances: maps for connections, type inference, and placements ----
  const instanceIdToCardId = new Map<string, string>();
  const colorByCardId = new Map<string, string>(); // first instance color per card
  const placeable: HeptaCardInstance[] = []; // valid instances (not on a trashed board)
  for (const raw of rawInstances) {
    const inst = normalizeInstance(raw);
    if (!inst) {
      report.instancesSkipped++;
      continue;
    }
    if (inst.whiteboardId && trashedBoards.has(inst.whiteboardId)) {
      report.instancesSkipped++;
      continue;
    }
    instanceIdToCardId.set(inst.id, inst.cardId);
    if (inst.color && !colorByCardId.has(inst.cardId)) colorByCardId.set(inst.cardId, inst.color);
    placeable.push(inst);
  }

  // ---- cards: content only (no x/y/boardId) ----
  const cards: Card[] = [];
  const keptCardIds = new Set<string>();
  for (const raw of rawCards) {
    const hc = normalizeCard(raw);
    if (!hc) {
      report.warnings.push('跳過一張無效卡片（缺少 id）');
      continue;
    }
    if (hc.isTrashed) {
      report.instancesSkipped++;
      continue;
    }

    let body = '';
    const ctx: ConvertCtx = { lossy: false };
    try {
      body = contentToMarkdown(hc.content, ctx);
    } catch (e) {
      report.warnings.push(`卡片 ${hc.id} 內容解析失敗: ${errMsg(e)}`);
      body = '';
    }
    if (ctx.lossy) report.lossyCards.push(hc.id);

    const title = deriveTitle(hc.title, body);
    const color = colorByCardId.get(hc.id);
    const type = (color ? HEPTA_COLOR_TO_TYPE[color] : undefined) ?? inferType(`${title}\n${body}`);

    const now = new Date().toISOString();
    const created = toISO(hc.createdTime, now);
    const updated = toISO(hc.lastEditedTime, created);

    cards.push({
      id: hc.id, // reuse the Heptabase uuid so connections still resolve
      type,
      title,
      body,
      tags: [],
      created,
      updated,
    });
    keptCardIds.add(hc.id);
  }

  // ---- placements: each instance → a placement on its board (many-to-many) ----
  for (const inst of placeable) {
    if (!keptCardIds.has(inst.cardId)) continue; // instance to a trashed/missing card
    const board = boardById.get(inst.whiteboardId);
    if (!board) continue; // instance to a board not in the (non-trashed) list
    const placement: Placement = {
      cardId: inst.cardId,
      x: Math.round(inst.x),
      y: Math.round(inst.y),
    };
    board.placements.push(placement);
  }

  // ---- connections → links (undirected, deduped) ----
  const links: Link[] = [];
  const seenLinks = new Set<string>();
  for (const raw of rawConnections) {
    const conn = normalizeConnection(raw);
    if (!conn) {
      report.connectionsDropped++;
      continue;
    }
    const aCard = instanceIdToCardId.get(conn.beginId);
    const bCard = instanceIdToCardId.get(conn.endId);
    if (
      !aCard ||
      !bCard ||
      aCard === bCard ||
      !keptCardIds.has(aCard) ||
      !keptCardIds.has(bCard)
    ) {
      report.connectionsDropped++;
      continue;
    }
    const key = linkKey(aCard, bCard);
    if (seenLinks.has(key)) continue; // duplicate edge — silently merged
    seenLinks.add(key);
    links.push({ a: aCard, b: bCard, type: 'solid' });
  }

  report.cardsImported = cards.length;
  report.linksImported = links.length;
  if (boards.length > 0) report.warnings.push(`已建立 ${boards.length} 個白板`);

  return { data: { cards, links, projects: [], diary: [], boards }, report };
}
