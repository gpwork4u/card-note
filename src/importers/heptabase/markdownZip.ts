import { strFromU8, unzipSync } from 'fflate';
import type { AppData } from '@/store';
import type { Card, ImportReport } from '@/types';
import { inferType } from '@/lib/derive';
import { ulid } from '@/lib/ulid';
import { parseDoc } from '@/serialization/frontmatter';
import { importAllData } from './allData';
import { basename, emptyData, emptyReport, errMsg, hasCardList, toISO } from './schema';

interface MdFile {
  name: string;
  text: string;
}

/**
 * Import a Heptabase `.zip` export. If the archive contains an `All-Data.json`
 * (or any *.json with a cardList) the JSON path is taken; otherwise every `.md`
 * file in the archive is imported as a card. Never throws.
 */
export function importFromZip(buffer: ArrayBuffer): { data: AppData; report: ImportReport } {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch (e) {
    const report = emptyReport();
    report.warnings.push(`ZIP 解壓失敗: ${errMsg(e)}`);
    return { data: emptyData(), report };
  }

  const paths = Object.keys(entries).filter(
    (p) => !p.endsWith('/') && !p.startsWith('__MACOSX/'),
  );

  // 1) prefer a file literally named All-Data.json (anywhere in the tree)
  let jsonPath = paths.find(
    (p) => basename(p).toLowerCase() === 'all-data.json',
  );

  // 2) otherwise any *.json whose content has a cardList
  if (!jsonPath) {
    for (const p of paths) {
      if (!p.toLowerCase().endsWith('.json')) continue;
      try {
        const parsed: unknown = JSON.parse(strFromU8(entries[p]));
        if (hasCardList(parsed)) {
          jsonPath = p;
          break;
        }
      } catch {
        // not valid JSON — ignore and keep scanning
      }
    }
  }

  if (jsonPath) {
    try {
      return importAllData(strFromU8(entries[jsonPath]));
    } catch (e) {
      const report = emptyReport();
      report.warnings.push(`讀取 ${jsonPath} 失敗: ${errMsg(e)}`);
      return { data: emptyData(), report };
    }
  }

  // 3) no JSON → treat every .md as a card
  const mdFiles: MdFile[] = [];
  for (const p of paths) {
    if (!p.toLowerCase().endsWith('.md')) continue;
    try {
      mdFiles.push({ name: p, text: strFromU8(entries[p]) });
    } catch (e) {
      // record but keep going; emptyReport here is just for the message vector
      mdFiles.push({ name: p, text: '' });
      void e;
    }
  }
  return importMarkdownFiles(mdFiles);
}

function parseTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Import a set of Markdown documents (each with optional YAML frontmatter) as
 * cards laid out on a grid. No links or coordinates come from this path.
 */
export function importMarkdownFiles(files: MdFile[]): { data: AppData; report: ImportReport } {
  const report = emptyReport();
  const cards: Card[] = [];

  for (const f of files) {
    try {
      const { data: fm, body } = parseDoc(f.text);
      const fileName = basename(f.name).replace(/\.md$/i, '').trim();

      const fmTitle = typeof fm.title === 'string' ? fm.title.trim() : '';
      const title = fmTitle || fileName || '(無標題)';

      const tags = parseTags(fm.tags);
      const type = inferType(`${title}\n${body}`);

      const now = new Date().toISOString();
      const created = toISO(fm.created ?? fm.createdTime, now);
      const updated = toISO(fm.lastEdited ?? fm.lastEditedTime ?? fm.updated, created);

      cards.push({
        id: ulid(),
        type,
        title,
        body,
        tags,
        created,
        updated,
      });
    } catch (e) {
      report.warnings.push(`Markdown 檔 ${f.name} 解析失敗: ${errMsg(e)}`);
    }
  }

  report.cardsImported = cards.length;
  return { data: { cards, links: [], projects: [], diary: [], boards: [] }, report };
}
