import Anthropic from '@anthropic-ai/sdk';
import type {
  AiProvider,
  Card,
  CardType,
  Classification,
  DiaryEntry,
  ExtractedCard,
  Link,
  LinkSuggestion,
  SearchResult,
} from '@/types';
import { linkKey } from '@/lib/derive';

// 搜尋/建議/擷取走 Opus（語意理解），分類走 Haiku（大量、輕量、低延遲）。
const REASONING_MODEL = 'claude-opus-4-8';
const FAST_MODEL = 'claude-haiku-4-5';

const CARD_TYPES: CardType[] = ['idea', 'research', 'compete', 'meeting', 'design', 'tech', 'okr'];

/** 每張卡片內文放進 context 的長度上限（幾百張卡也能整包進 cached system block）。 */
const BODY_LIMIT = 600;

function cardLine(c: Card): string {
  const body = c.body.length > BODY_LIMIT ? c.body.slice(0, BODY_LIMIT) + '…' : c.body;
  const tags = c.tags.length ? ' :: #' + c.tags.join(' #') : '';
  return `[${c.id}](${c.type}) ${c.title} :: ${body.replace(/\n+/g, ' ')}${tags}`;
}

/** 全卡片庫的 system block；標 cache_control 讓多次查詢重用前綴快取。 */
function cardsSystemBlock(cards: Card[]): Anthropic.TextBlockParam {
  return {
    type: 'text',
    text:
      '以下是使用者卡片盒筆記的全部卡片，格式為 [id](type) 標題 :: 內文 :: #標籤：\n\n' +
      cards.map(cardLine).join('\n'),
    cache_control: { type: 'ephemeral' },
  };
}

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: '根據卡片內容、以繁體中文回答問題的摘要' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: '引用的卡片 id' },
          quote: { type: 'string', description: '該卡片中支持回答的一句原文' },
        },
        required: ['cardId', 'quote'],
        additionalProperties: false,
      },
    },
  },
  required: ['answer', 'citations'],
  additionalProperties: false,
} as const;

const SUGGEST_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          a: { type: 'string', description: '卡片 id' },
          b: { type: 'string', description: '另一張卡片 id' },
          reason: { type: 'string', description: '為何這兩張卡片相關（繁體中文，一句話）' },
        },
        required: ['a', 'b', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
} as const;

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          type: { type: 'string', enum: CARD_TYPES },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'body', 'type', 'tags'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards'],
  additionalProperties: false,
} as const;

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: CARD_TYPES },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'tags'],
  additionalProperties: false,
} as const;

/** 把 SDK 例外轉成可直接顯示給使用者的繁中訊息。 */
function friendlyError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) {
    return new Error('Anthropic API key 無效或已撤銷，請到設定頁更新。');
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new Error('已達 Anthropic API 速率限制，請稍候再試。');
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new Error('無法連線到 Anthropic API，請檢查網路。');
  }
  if (e instanceof Anthropic.APIError) {
    return new Error(`Claude API 錯誤（${e.status}）：${e.message}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * 啟用前驗證 key：對 app 實際使用的兩個模型各打一次免費的 count_tokens
 * 端點——key 無效會拿到 401，缺少某個模型的存取權會拿到 403/404。
 * 不消耗任何 token。
 */
export async function verifyAnthropicKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    await Promise.all(
      [REASONING_MODEL, FAST_MODEL].map((model) =>
        client.messages.countTokens({
          model,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      ),
    );
  } catch (e) {
    throw friendlyError(e);
  }
}

export class ClaudeProvider implements AiProvider {
  readonly id = 'claude' as const;
  readonly label = 'Claude（雲端）';

  private client: Anthropic;

  constructor(apiKey: string) {
    // key 只存在本機 IndexedDB；瀏覽器直連需要明確 opt-in
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  /** 呼叫 API 並取回符合 schema 的 JSON。refusal 或空回應會丟錯給 UI 顯示。 */
  private async json<T>(req: {
    model: string;
    system: Anthropic.TextBlockParam[];
    prompt: string;
    schema: Record<string, unknown>;
    maxTokens: number;
    thinking?: boolean;
  }): Promise<T> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        ...(req.thinking ? { thinking: { type: 'adaptive' as const } } : {}),
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        output_config: { format: { type: 'json_schema', schema: req.schema } },
      });
    } catch (e) {
      throw friendlyError(e);
    }
    if (response.stop_reason === 'refusal') {
      throw new Error('Claude 拒絕了這個請求，請換個問法。');
    }
    const text = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    )?.text;
    if (!text) throw new Error('Claude 回應為空，請稍後再試。');
    return JSON.parse(text) as T;
  }

  async search(question: string, cards: Card[]): Promise<SearchResult> {
    if (cards.length === 0) return { answer: '卡片庫是空的，先寫幾張卡片吧。', citations: [] };
    const result = await this.json<SearchResult>({
      model: REASONING_MODEL,
      thinking: true,
      system: [
        {
          type: 'text',
          text: '你是卡片盒筆記系統的搜尋助手。只根據提供的卡片內容回答，用繁體中文，並引用相關卡片。若卡片中沒有相關內容，直接說明找不到。',
        },
        cardsSystemBlock(cards),
      ],
      prompt: `問題：${question}`,
      schema: SEARCH_SCHEMA,
      maxTokens: 2048,
    });
    const known = new Set(cards.map((c) => c.id));
    return { ...result, citations: result.citations.filter((c) => known.has(c.cardId)) };
  }

  async suggestLinks(
    cards: Card[],
    existing: Link[],
    focusCardId?: string,
  ): Promise<LinkSuggestion[]> {
    if (cards.length < 2) return [];
    const focus = focusCardId ? cards.find((c) => c.id === focusCardId) : undefined;
    const result = await this.json<{ suggestions: LinkSuggestion[] }>({
      model: REASONING_MODEL,
      thinking: true,
      system: [
        {
          type: 'text',
          text: '你是卡片盒筆記（Zettelkasten）的連結建議助手。找出概念上真正相關、值得建立雙向連結的卡片配對；重質不重量，最多 8 組。理由用繁體中文一句話。',
        },
        cardsSystemBlock(cards),
      ],
      prompt: focus
        ? `請建議與卡片 [${focus.id}]「${focus.title}」相關的其他卡片。`
        : '請在整個卡片庫中建議值得連結的卡片配對。',
      schema: SUGGEST_SCHEMA,
      maxTokens: 2048,
    });
    // 過濾：id 必須存在、不能自連、不能與「已確認」連結重複。
    // AI 建議（type: 'ai'）不算已存在——setAiSuggestions 會整批替換，
    // 若把它們當 taken，重新產生時會把仍待處理的相同建議全數濾掉。
    const known = new Set(cards.map((c) => c.id));
    const taken = new Set(
      existing.filter((l) => l.type === 'solid').map((l) => linkKey(l.a, l.b)),
    );
    const seen = new Set<string>();
    return result.suggestions.filter((s) => {
      if (!known.has(s.a) || !known.has(s.b) || s.a === s.b) return false;
      const key = linkKey(s.a, s.b);
      if (taken.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async extractCardsFromDiary(entry: DiaryEntry, knownTags: string[]): Promise<ExtractedCard[]> {
    const result = await this.json<{ cards: ExtractedCard[] }>({
      model: REASONING_MODEL,
      thinking: true,
      system: [
        {
          type: 'text',
          text:
            '你是卡片盒筆記的日記整理助手。從日記中擷取值得變成永久卡片的想法（原子化：一張卡一個概念），改寫成獨立可讀的卡片。沒有值得擷取的內容就回空陣列。' +
            (knownTags.length ? `\n\n使用者既有的標籤（優先重用）：${knownTags.join('、')}` : ''),
        },
      ],
      prompt: `日記（${entry.date}）：\n\n${entry.text}`,
      schema: EXTRACT_SCHEMA,
      maxTokens: 2048,
    });
    return result.cards;
  }

  async autoClassify(card: Pick<Card, 'title' | 'body' | 'tags'>): Promise<Classification> {
    return this.json<Classification>({
      model: FAST_MODEL,
      system: [
        {
          type: 'text',
          text: `你是卡片分類器。根據標題與內文判斷卡片型別（${CARD_TYPES.join('/')}）並給 1-3 個繁體中文標籤。`,
        },
      ],
      prompt: `標題：${card.title}\n內文：${card.body.slice(0, BODY_LIMIT)}\n現有標籤：${card.tags.join('、') || '無'}`,
      schema: CLASSIFY_SCHEMA,
      maxTokens: 256,
    });
  }
}
