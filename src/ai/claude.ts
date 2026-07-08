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

// 搜尋/建議/擷取走 reasoning 模型（語意理解），分類走 fast 模型（大量、輕量、低延遲）。
// 不是每把 key 都有所有模型的存取權，依序 fallback 到 key 實際可用的模型。
const REASONING_CANDIDATES = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];
const FAST_CANDIDATES = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'];

export interface ResolvedModels {
  reasoning: string;
  fast: string;
}

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

/** 用免費的 count_tokens 端點探測某個模型是否可用（不消耗 token）。 */
async function probe(client: Anthropic, model: string): Promise<void> {
  await client.messages.countTokens({
    model,
    messages: [{ role: 'user', content: 'ping' }],
  });
}

/** 依序找出這把 key 第一個可用的模型；401/網路/限流直接失敗，403/404 換下一個。 */
async function firstAvailable(client: Anthropic, candidates: string[]): Promise<string> {
  for (const model of candidates) {
    try {
      await probe(client, model);
      return model;
    } catch (e) {
      if (
        e instanceof Anthropic.AuthenticationError ||
        e instanceof Anthropic.APIConnectionError ||
        e instanceof Anthropic.RateLimitError
      ) {
        throw friendlyError(e);
      }
      // 403/404 = 這把 key 沒有此模型的存取權 → 試下一個候選
    }
  }
  throw new Error('這把 API key 沒有任何可用的 Claude 模型存取權，請確認方案或換一把 key。');
}

/** 解析這把 key 實際可用的 reasoning / fast 模型組合。 */
export async function resolveModels(client: Anthropic): Promise<ResolvedModels> {
  const reasoning = await firstAvailable(client, REASONING_CANDIDATES);
  const fast =
    reasoning === FAST_CANDIDATES[0]
      ? reasoning
      : await firstAvailable(client, FAST_CANDIDATES);
  return { reasoning, fast };
}

/**
 * 啟用前驗證 key：key 無效（401）會失敗；有效但缺部分模型權限時
 * 會自動 fallback，並回傳實際會使用的模型組合。不消耗任何 token。
 */
export async function verifyAnthropicKey(apiKey: string): Promise<ResolvedModels> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return resolveModels(client);
}

export class ClaudeProvider implements AiProvider {
  readonly id = 'claude' as const;
  readonly label = 'Claude（雲端）';

  private client: Anthropic;
  private modelsPromise: Promise<ResolvedModels> | null = null;

  constructor(apiKey: string) {
    // key 只存在本機 IndexedDB；瀏覽器直連需要明確 opt-in
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  /** 第一次呼叫時解析可用模型並快取；失敗（如暫時斷網）下次重試。 */
  private models(): Promise<ResolvedModels> {
    if (!this.modelsPromise) {
      this.modelsPromise = resolveModels(this.client).catch((e) => {
        this.modelsPromise = null;
        throw e;
      });
    }
    return this.modelsPromise;
  }

  /** 呼叫 API 並取回符合 schema 的 JSON。refusal 或空回應會丟錯給 UI 顯示。 */
  private async json<T>(req: {
    tier: 'reasoning' | 'fast';
    system: Anthropic.TextBlockParam[];
    prompt: string;
    schema: Record<string, unknown>;
    maxTokens: number;
    thinking?: boolean;
  }): Promise<T> {
    const models = await this.models();
    const model = req.tier === 'fast' ? models.fast : models.reasoning;
    // adaptive thinking 只有 opus/sonnet 支援；fallback 到 haiku 時不能帶
    const adaptive = Boolean(req.thinking) && !model.includes('haiku');
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model,
        max_tokens: req.maxTokens,
        ...(adaptive ? { thinking: { type: 'adaptive' as const } } : {}),
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
      tier: 'reasoning',
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
      tier: 'reasoning',
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
      tier: 'reasoning',
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
      tier: 'fast',
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
