import type { AppData } from '@/store';
import type { ImportReport } from '@/types';
import { importAllData } from './allData';
import { importFromZip, importMarkdownFiles } from './markdownZip';
import { emptyData, emptyReport, errMsg } from './schema';

export { importAllData } from './allData';
export { importFromZip, importMarkdownFiles } from './markdownZip';
export { contentToMarkdown } from './prosemirror';

/** ZIP local-file-header magic: "PK\x03\x04" (also \x05\x06 empty, \x07\x08 spanned) */
function looksLikeZip(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf);
  return (
    b.length >= 4 &&
    b[0] === 0x50 &&
    b[1] === 0x4b &&
    (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)
  );
}

/**
 * Import a Heptabase export from a File. Routes by extension, falling back to
 * content sniffing for unknown extensions:
 *   - `.json`           → All-Data.json JSON path
 *   - `.zip`            → unzip, then JSON (if All-Data.json present) else .md
 *   - otherwise         → sniff magic bytes / leading char
 *
 * Always resolves (never rejects): failures are captured in `report.warnings`.
 */
export async function importFromFile(
  file: File,
): Promise<{ data: AppData; report: ImportReport }> {
  try {
    const name = file.name.toLowerCase();

    if (name.endsWith('.zip')) {
      return importFromZip(await file.arrayBuffer());
    }
    if (name.endsWith('.json')) {
      return importAllData(await file.text());
    }

    // unknown extension → sniff the bytes
    const buf = await file.arrayBuffer();
    if (looksLikeZip(buf)) {
      return importFromZip(buf);
    }
    const text = new TextDecoder().decode(new Uint8Array(buf));
    const head = text.trimStart();
    if (head.startsWith('{') || head.startsWith('[')) {
      return importAllData(text);
    }
    // last resort: treat the whole file as a single markdown card
    return importMarkdownFiles([{ name: file.name, text }]);
  } catch (e) {
    const report = emptyReport();
    report.warnings.push(`匯入失敗: ${errMsg(e)}`);
    return { data: emptyData(), report };
  }
}
