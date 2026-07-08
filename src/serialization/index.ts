import type { AppData } from '@/store';
import { cardIdFromPath, cardPath, parseCard, serializeCard } from './cardFile';
import { LINKS_PATH, parseLinks, serializeLinks } from './linksFile';
import { parseProject, projectIdFromPath, projectPath, serializeProject } from './projectFile';
import { diaryDateFromPath, diaryPath, parseDiary, serializeDiary } from './diaryFile';
import { boardIdFromPath, boardPath, parseBoard, serializeBoard } from './boardFile';

export * from './cardFile';
export * from './linksFile';
export * from './projectFile';
export * from './diaryFile';
export * from './boardFile';
export * from './frontmatter';

export const MANIFEST_PATH = 'cardnote.json';

/** The repo file map: path → file content. This is what we diff, cache and push. */
export type FileMap = Record<string, string>;

/** Serialize the whole app data set into the repo file map. */
export function serializeAll(data: AppData): FileMap {
  const files: FileMap = {};
  files[MANIFEST_PATH] = JSON.stringify({ schemaVersion: 2, app: 'card-note' }, null, 2) + '\n';
  for (const c of data.cards) files[cardPath(c.id)] = serializeCard(c);
  files[LINKS_PATH] = serializeLinks(data.links);
  for (const p of data.projects) files[projectPath(p.id)] = serializeProject(p);
  for (const d of data.diary) files[diaryPath(d.date)] = serializeDiary(d);
  for (const b of data.boards) files[boardPath(b.id)] = serializeBoard(b);
  return files;
}

/** Rebuild app data from a repo file map (ignores unknown paths). */
export function parseAll(files: FileMap): AppData {
  const data: AppData = { cards: [], links: [], projects: [], diary: [], boards: [] };
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('cards/') && path.endsWith('.md')) {
      data.cards.push(parseCard(content, cardIdFromPath(path)));
    } else if (path === LINKS_PATH) {
      data.links.push(...parseLinks(content));
    } else if (path.startsWith('projects/') && path.endsWith('.json')) {
      data.projects.push(parseProject(content, projectIdFromPath(path)));
    } else if (path.startsWith('diary/') && path.endsWith('.md')) {
      data.diary.push(parseDiary(content, diaryDateFromPath(path)));
    } else if (path.startsWith('boards/') && path.endsWith('.json')) {
      data.boards.push(parseBoard(content, boardIdFromPath(path)));
    }
  }
  // newest diary first (matches the UI), cards keep insertion order
  data.diary.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return data;
}
