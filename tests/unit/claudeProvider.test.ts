import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeProvider, verifyAnthropicKey } from '@/ai/claude';
import type { Card, Link } from '@/types';

/**
 * 離線驗證 ClaudeProvider 真正送出去的 HTTP 請求形狀與回應處理。
 * 不需要真實 API key——攔截 global fetch（SDK 沒帶自訂 fetch 時就用它）。
 * 真實 key 的 live 呼叫另外驗，這裡鎖住的是「請求長對、回應解對」。
 */

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

let captured: Captured[] = [];

/** 依序回應的假伺服器；handler 回傳 [status, body]。 */
function mockApi(handler: (c: Captured, i: number) => [number, unknown]) {
  vi.stubGlobal('fetch', async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const c = { url, body };
    const i = captured.length;
    captured.push(c);
    const [status, payload] = handler(c, i);
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

const isProbe = (c: Captured) => c.url.includes('count_tokens');

/** 一般 messages 回應：單一 text block，內容是 JSON 字串。 */
function textReply(json: unknown) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-8',
    content: [{ type: 'text', text: JSON.stringify(json) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

const card = (id: string, title: string, extra: Partial<Card> = {}): Card => ({
  id,
  type: 'idea',
  title,
  body: `${title} 的內容`,
  tags: ['標籤'],
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  captured = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClaudeProvider 請求形狀', () => {
  it('search：帶 adaptive thinking、structured output、卡片庫走 cached system block', async () => {
    mockApi((c) => (isProbe(c) ? [200, { input_tokens: 1 }] : [200, textReply({ answer: '答案', citations: [{ cardId: 'a', quote: '原文' }] })]));

    const res = await new ClaudeProvider('sk-test').search('問題？', [card('a', '甲'), card('b', '乙')]);

    const req = captured.find((c) => !isProbe(c))!;
    expect(req.body.model).toBe('claude-opus-4-8');
    expect(req.body.thinking).toEqual({ type: 'adaptive' });
    expect((req.body.output_config as any).format.type).toBe('json_schema');
    const system = req.body.system as any[];
    expect(system).toHaveLength(2);
    expect(system[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(system[1].text).toContain('[a](idea) 甲');
    expect(res.answer).toBe('答案');
  });

  it('classify 走 fast 模型且不帶 thinking（haiku 不支援 adaptive）', async () => {
    mockApi((c) => (isProbe(c) ? [200, { input_tokens: 1 }] : [200, textReply({ type: 'tech', tags: ['a'] })]));

    await new ClaudeProvider('sk-test').autoClassify({ title: 't', body: 'b', tags: [] });

    const req = captured.find((c) => !isProbe(c))!;
    expect(req.body.model).toBe('claude-haiku-4-5');
    expect(req.body.thinking).toBeUndefined();
  });

  it('模型 entitlement fallback：403/404 換下一個候選，401 直接失敗', async () => {
    // opus-4-8 無權限 → sonnet-5 可用
    mockApi((c) => {
      if (!isProbe(c)) return [200, textReply({ answer: 'x', citations: [] })];
      const model = c.body.model as string;
      if (model === 'claude-opus-4-8') return [404, { type: 'error', error: { type: 'not_found_error', message: 'no access' } }];
      return [200, { input_tokens: 1 }];
    });

    await new ClaudeProvider('sk-test').search('q', [card('a', '甲')]);
    expect((captured.find((c) => !isProbe(c))!.body as any).model).toBe('claude-sonnet-5');
  });

  it('key 無效（401）在驗證階段就報繁中錯誤，不會被誤判成沒權限而換模型', async () => {
    mockApi(() => [401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }]);

    await expect(verifyAnthropicKey('sk-bad')).rejects.toThrow('API key 無效');
    // 401 不該把候選模型全試一輪
    expect(captured).toHaveLength(1);
  });
});

describe('ClaudeProvider 回應處理', () => {
  it('refusal 轉成可讀訊息', async () => {
    mockApi((c) =>
      isProbe(c)
        ? [200, { input_tokens: 1 }]
        : [200, { ...textReply({}), content: [], stop_reason: 'refusal' }],
    );

    await expect(new ClaudeProvider('sk-test').search('q', [card('a', '甲')])).rejects.toThrow('拒絕');
  });

  it('max_tokens 截斷不會變成看不懂的 JSON parse 錯誤', async () => {
    mockApi((c) =>
      isProbe(c)
        ? [200, { input_tokens: 1 }]
        : [200, { ...textReply({}), content: [{ type: 'text', text: '{"answer":"被截' }], stop_reason: 'max_tokens' }],
    );

    await expect(new ClaudeProvider('sk-test').search('q', [card('a', '甲')])).rejects.toThrow('過長');
  });

  it('suggestLinks 過濾未知 id、自連、已確認連結與重複配對', async () => {
    const suggestions = [
      { a: 'a', b: 'b', reason: '相關' },
      { a: 'a', b: 'zzz', reason: '不存在的卡' },
      { a: 'c', b: 'c', reason: '自連' },
      { a: 'b', b: 'a', reason: '與第一組重複（反向）' },
      { a: 'a', b: 'c', reason: '已是 solid 連結' },
    ];
    mockApi((c) => (isProbe(c) ? [200, { input_tokens: 1 }] : [200, textReply({ suggestions })]));

    const existing: Link[] = [{ a: 'a', b: 'c', type: 'solid' }];
    const out = await new ClaudeProvider('sk-test').suggestLinks(
      [card('a', '甲'), card('b', '乙'), card('c', '丙')],
      existing,
    );

    expect(out).toEqual([{ a: 'a', b: 'b', reason: '相關' }]);
  });

  it('AI 建議連結不算已存在，重新產生時不會被自己濾光', async () => {
    mockApi((c) => (isProbe(c) ? [200, { input_tokens: 1 }] : [200, textReply({ suggestions: [{ a: 'a', b: 'b', reason: 'r' }] })]));

    const existing: Link[] = [{ a: 'a', b: 'b', type: 'ai', reason: '上一輪的建議' }];
    const out = await new ClaudeProvider('sk-test').suggestLinks([card('a', '甲'), card('b', '乙')], existing);

    expect(out).toHaveLength(1);
  });

  it('空卡片庫不打 API', async () => {
    mockApi(() => [500, {}]);
    const res = await new ClaudeProvider('sk-test').search('q', []);
    expect(res.citations).toEqual([]);
    expect(captured).toHaveLength(0);
  });
});
