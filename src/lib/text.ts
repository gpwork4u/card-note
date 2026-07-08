// Lightweight, dependency-free text utilities for the local (non-LLM) AI provider.
// Handles CJK (no word boundaries) via character bigrams + ascii word tokens.

const STOP = new Set([
  '的', '了', '是', '在', '和', '與', '也', '都', '我', '你', '他', '她', '它',
  '這', '那', '有', '個', '不', '要', '會', '把', '讓', '對', '到', '就', '很',
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'is', 'it', 'for', 'on',
]);

export function terms(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  const lower = text.toLowerCase();
  // ascii words
  for (const w of lower.match(/[a-z0-9]{2,}/g) ?? []) {
    if (!STOP.has(w)) out.add(w);
  }
  // CJK bigrams
  const cjk = lower.match(/[一-鿿]+/g) ?? [];
  for (const run of cjk) {
    if (run.length === 1) {
      if (!STOP.has(run)) out.add(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      out.add(run.slice(i, i + 2));
    }
  }
  return out;
}

/** Jaccard-ish overlap score in [0,1] between two term sets. */
export function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) inter++;
  return inter / Math.sqrt(a.size * b.size);
}

/** terms shared by both sets, longest first (for "都提到：…" reasons) */
export function sharedTerms(a: Set<string>, b: Set<string>): string[] {
  const shared: string[] = [];
  for (const t of a) if (b.has(t)) shared.push(t);
  return shared.sort((x, y) => y.length - x.length);
}

export function firstSentence(text: string, max = 24): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const cut = clean.split(/[。！？.!?\n]/)[0] ?? clean;
  return cut.length > max ? cut.slice(0, max) + '…' : cut;
}

/** split a diary entry into meaningful chunks for card extraction */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 6);
}
