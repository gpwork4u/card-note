import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { aiSearch, aiIsLocal } from '@/ai';
import type { Card, SearchResult } from '@/types';
import { CARD_TYPES } from '@/lib/tokens';
import { Modal } from '@/components/common/Modal';
import { SparkleIcon } from '@/components/common/icons';

export function AiSearchOverlay() {
  const open = useStore((s) => s.searchOpen);
  const query = useStore((s) => s.searchQuery);
  const setQuery = useStore((s) => s.setSearchQuery);
  const closeSearch = useStore((s) => s.closeSearch);
  const cards = useStore((s) => s.cards);
  const selectCard = useStore((s) => s.selectCard);
  const setView = useStore((s) => s.setView);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    if (!q.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await aiSearch(q));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void run(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const citedCards = (result?.citations ?? [])
    .map((c) => {
      const card = cards.find((x) => x.id === c.cardId);
      return card ? { card, quote: c.quote } : null;
    })
    .filter((c): c is { card: Card; quote: string | undefined } => c !== null);

  return (
    <Modal onClose={closeSearch} width={640} align="top" zIndex={80}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '18px 20px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <SparkleIcon size={20} style={{ color: '#7048e8' }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run(query);
          }}
          placeholder="問問你的筆記：例如「客戶對匯出有什麼需求？」"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent', fontFamily: 'inherit' }}
        />
        <span className="mono" style={{ fontSize: 11, color: '#b0b0b8', border: '1px solid rgba(0,0,0,.1)', padding: '2px 6px', borderRadius: 5 }}>
          ESC
        </span>
      </div>
      <div className="scrl" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '18px 20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#7048e8,#4263eb)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SparkleIcon size={14} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.8, color: '#2a2a32' }}>
            {loading ? (
              <span style={{ color: '#9a9aa4' }}>
                <span className="spinner" style={{ marginRight: 8, verticalAlign: 'middle' }} /> 搜尋中…
              </span>
            ) : error ? (
              <span style={{ color: '#b0535e' }}>搜尋失敗：{error}</span>
            ) : result ? (
              result.answer
            ) : (
              <span style={{ color: '#9a9aa4' }}>輸入問題後按 Enter，從你的卡片裡找答案。</span>
            )}
          </div>
        </div>

        {citedCards.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9a9aa4', letterSpacing: 0.5, marginBottom: 10 }}>
              引用了這些卡片
            </div>
            {citedCards.map(({ card, quote }) => (
              <button
                key={card.id}
                onClick={() => {
                  selectCard(card.id);
                  setView('whiteboard');
                  closeSearch();
                }}
                className="reset-btn hover-tint"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', border: '1px solid rgba(0,0,0,.08)', borderRadius: 11, marginBottom: 8, width: '100%' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CARD_TYPES[card.type].color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a32' }}>{card.title}</div>
                  <div style={{ fontSize: 11, color: '#9a9aa4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {quote || CARD_TYPES[card.type].label}
                  </div>
                </div>
                <span style={{ color: '#c0c0c8' }}>↗</span>
              </button>
            ))}
          </>
        )}

        {aiIsLocal() && (
          <div style={{ marginTop: 14, fontSize: 11, color: '#b0b0b8', textAlign: 'center' }}>
            目前使用本機關鍵字搜尋。在設定頁接上 Claude API 後，這裡會變成語意理解的回答。
          </div>
        )}
      </div>
    </Modal>
  );
}
