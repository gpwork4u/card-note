import { useState } from 'react';
import { useStore } from '@/store';
import { CARD_TYPES } from '@/lib/tokens';
import { aiSuggestLinks } from '@/ai';
import { LinkIcon, SparkleIcon } from '@/components/common/icons';

export function AiSuggestionsContent() {
  const links = useStore((s) => s.links);
  const cards = useStore((s) => s.cards);
  const acceptLink = useStore((s) => s.acceptLink);
  const dismissLink = useStore((s) => s.dismissLink);
  const [busy, setBusy] = useState(false);

  const cardById = (id: string) => cards.find((c) => c.id === id);
  const suggestions = links
    .filter((l) => l.type === 'ai')
    .map((l) => {
      const A = cardById(l.a);
      const B = cardById(l.b);
      return A && B ? { a: l.a, b: l.b, A, B, reason: l.reason ?? '' } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  async function regenerate() {
    setBusy(true);
    try {
      await aiSuggestLinks();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrl" style={{ maxHeight: 420, overflowY: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 3px' }}>
        <div style={{ fontSize: 11.5, color: '#9a9aa4', flex: 1 }}>在你的白板上，這些卡片可能相關：</div>
        <button
          onClick={regenerate}
          disabled={busy}
          className="reset-btn"
          style={{ fontSize: 11, color: '#6438d6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {busy ? <span className="spinner" /> : <SparkleIcon size={12} />} 重新產生
        </button>
      </div>

      {suggestions.map((sg) => (
        <div key={`${sg.a}-${sg.b}`} style={{ border: '1px solid #ece6fb', borderRadius: 12, padding: 12, marginBottom: 10, background: '#fdfcff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CARD_TYPES[sg.A.type].color }} />
            <span style={{ color: '#2a2a32' }}>{sg.A.title}</span>
          </div>
          <div style={{ margin: '0 0 6px 3px', color: '#c0b8e0' }}>
            <LinkIcon size={13} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CARD_TYPES[sg.B.type].color }} />
            <span style={{ color: '#2a2a32' }}>{sg.B.title}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#9a9aa4', lineHeight: 1.5, marginBottom: 10 }}>{sg.reason}</div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={() => acceptLink(sg.a, sg.b)} className="reset-btn" style={{ flex: 1, height: 30, background: '#6438d6', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>連結</button>
            <button onClick={() => dismissLink(sg.a, sg.b)} className="reset-btn" style={{ height: 30, padding: '0 13px', border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#8a8a94', borderRadius: 7, fontSize: 12 }}>略過</button>
          </div>
        </div>
      ))}

      {suggestions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 10px', color: '#b0b0b8', fontSize: 12.5 }}>
          已處理完所有建議 ✓
          <div style={{ marginTop: 10 }}>
            <button onClick={regenerate} disabled={busy} className="reset-btn" style={{ fontSize: 12, color: '#6438d6', fontWeight: 600 }}>
              {busy ? '產生中…' : '重新產生建議'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
