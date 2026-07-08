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

/**
 * ClaudeProvider — placeholder for the future browser-direct Claude integration.
 *
 * When wired up (user pastes their Anthropic API key in Settings), this becomes a
 * drop-in replacement for LocalProvider. Implementation notes for that step:
 *
 *   import Anthropic from '@anthropic-ai/sdk';
 *   const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
 *     // auto-adds `anthropic-dangerous-direct-browser-access: true`
 *
 *   Models:  reasoning → 'claude-sonnet-4-6'  (search / suggest / extract)
 *            fast      → 'claude-haiku-4-5'    (classify; do NOT pass `effort`)
 *
 *   Context: a few hundred cards fit in-context — stuff them into a cached system
 *            block ({ cache_control: { type: 'ephemeral' } }) as
 *            `[id](type) title :: body :: #tags`. No embeddings needed at this scale.
 *
 *   Structured output: output_config.format = { type: 'json_schema', schema }
 *            (schema needs additionalProperties:false + required); check
 *            stop_reason === 'refusal' before reading content. The zod schemas in
 *            ./schemas.ts are shared with this provider.
 *
 *   Security: key lives only in IndexedDB on this device, never committed to git.
 */
export class ClaudeProvider implements AiProvider {
  readonly id = 'claude' as const;
  readonly label = 'Claude（雲端）';

  constructor(private apiKey: string) {}

  private notReady(): never {
    throw new Error('Claude provider 尚未實作。請先在設定頁填入 API key，並完成 ./claude.ts 的接線。');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(_question: string, _cards: Card[]): Promise<SearchResult> {
    return this.notReady();
  }
  async suggestLinks(
    _cards: Card[],
    _existing: Link[],
    _focusCardId?: string,
  ): Promise<LinkSuggestion[]> {
    return this.notReady();
  }
  async extractCardsFromDiary(
    _entry: DiaryEntry,
    _knownTags: string[],
  ): Promise<ExtractedCard[]> {
    return this.notReady();
  }
  async autoClassify(_card: Pick<Card, 'title' | 'body' | 'tags'>): Promise<Classification> {
    return this.notReady();
  }
}
