import type {
  AiProvider,
  Card,
  Classification,
  DiaryEntry,
  ExtractedCard,
  Link,
  LinkSuggestion,
  SearchResult,
} from '@/types';
import { linkKey, inferType } from '@/lib/derive';
import { overlapScore, paragraphs, sharedTerms, terms, firstSentence } from '@/lib/text';

/**
 * LocalProvider — a fully offline, dependency-free stand-in for the (future)
 * Claude-powered provider. Every method returns the same shape the real one will,
 * so swapping in ClaudeProvider later is a drop-in change. Results are heuristic,
 * not semantic, but genuinely useful: real keyword/tag search, tag/keyword link
 * suggestions, paragraph-based diary extraction, rule-based classification.
 */
export class LocalProvider implements AiProvider {
  readonly id = 'local' as const;
  readonly label = '本機（離線）';

  async search(question: string, cards: Card[]): Promise<SearchResult> {
    const q = terms(question);
    const scored = cards
      .map((c) => {
        const ct = terms(`${c.title} ${c.body} ${c.tags.join(' ')}`);
        return { card: c, score: overlapScore(q, ct) };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) {
      return {
        answer: `在你的 ${cards.length} 張卡片裡沒有找到和「${question}」明顯相關的內容。試試不同的關鍵字，或之後接上 Claude 以獲得語意理解。`,
        citations: [],
      };
    }

    const titles = scored.map((s) => `「${s.card.title}」`).join('、');
    return {
      answer: `本機關鍵字比對在 ${cards.length} 張卡片中找到 ${scored.length} 張相關卡片，最相關的是 ${titles}。（接上 Claude API 後，這裡會變成真正讀懂內容的摘要式回答。）`,
      citations: scored.map((s) => ({
        cardId: s.card.id,
        quote: firstSentence(s.card.body, 40),
      })),
    };
  }

  async suggestLinks(
    cards: Card[],
    existing: Link[],
    focusCardId?: string,
  ): Promise<LinkSuggestion[]> {
    const solid = new Set(
      existing.filter((l) => l.type === 'solid').map((l) => linkKey(l.a, l.b)),
    );
    const termMap = new Map<string, Set<string>>();
    const tagMap = new Map<string, Set<string>>();
    for (const c of cards) {
      termMap.set(c.id, terms(`${c.title} ${c.body}`));
      tagMap.set(c.id, new Set(c.tags));
    }

    const pool = focusCardId ? cards.filter((c) => c.id !== focusCardId) : cards;
    const anchors = focusCardId ? cards.filter((c) => c.id === focusCardId) : cards;

    const seen = new Set<string>();
    const out: { sg: LinkSuggestion; score: number }[] = [];
    for (const a of anchors) {
      for (const b of pool) {
        if (a.id === b.id) continue;
        const key = linkKey(a.id, b.id);
        if (solid.has(key) || seen.has(key)) continue;
        seen.add(key);

        const sharedTags = [...(tagMap.get(a.id) ?? [])].filter((t) =>
          tagMap.get(b.id)?.has(t),
        );
        const overlap = overlapScore(termMap.get(a.id)!, termMap.get(b.id)!);
        const score = sharedTags.length * 0.5 + overlap;
        if (score < 0.18 && sharedTags.length === 0) continue;

        let reason: string;
        if (sharedTags.length) {
          reason = `共同標籤：${sharedTags.map((t) => `#${t}`).join('、')}`;
        } else {
          const common = sharedTerms(termMap.get(a.id)!, termMap.get(b.id)!).slice(0, 3);
          reason = common.length ? `都提到：${common.join('、')}` : '內容用詞相近，可能相關。';
        }
        out.push({ sg: { a: a.id, b: b.id, reason }, score });
      }
    }
    return out
      .sort((x, y) => y.score - x.score)
      .slice(0, focusCardId ? 4 : 8)
      .map((x) => x.sg);
  }

  async extractCardsFromDiary(
    entry: DiaryEntry,
    knownTags: string[],
  ): Promise<ExtractedCard[]> {
    const known = new Set(knownTags);
    return paragraphs(entry.text).map((p) => {
      const cardTerms = terms(p);
      const tags = [...known].filter((t) => cardTerms.has(t) || p.includes(t)).slice(0, 3);
      return {
        title: firstSentence(p, 20),
        body: p,
        type: inferType(p),
        tags,
      };
    });
  }

  async autoClassify(card: Pick<Card, 'title' | 'body' | 'tags'>): Promise<Classification> {
    return { type: inferType(`${card.title} ${card.body} ${card.tags.join(' ')}`) };
  }
}
