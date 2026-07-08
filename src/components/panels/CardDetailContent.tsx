import { useMemo } from 'react';
import { useStore } from '@/store';
import { CARD_TYPES, CARD_TYPE_LIST } from '@/lib/tokens';
import { enrichCard, otherEnd } from '@/lib/derive';
import type { CardType } from '@/types';
import { TypeDot } from '@/components/common/CardTypeBadge';
import { SparkleIcon, TrashIcon, CloseIcon } from '@/components/common/icons';

/** Inner content of the card detail panel (host adds the chrome: side-panel or sheet). */
export function CardDetailContent({ onClose }: { onClose: () => void }) {
  const selectedId = useStore((s) => s.selectedId);
  const cards = useStore((s) => s.cards);
  const links = useStore((s) => s.links);
  const boards = useStore((s) => s.boards);
  const updateCard = useStore((s) => s.updateCard);
  const deleteCard = useStore((s) => s.deleteCard);
  const selectCard = useStore((s) => s.selectCard);
  const acceptLink = useStore((s) => s.acceptLink);
  const dismissLink = useStore((s) => s.dismissLink);
  const removeCardFromBoard = useStore((s) => s.removeCardFromBoard);

  const card = useMemo(
    () => (selectedId ? cards.find((c) => c.id === selectedId) ?? null : null),
    [cards, selectedId],
  );

  const view = useMemo(() => {
    if (!card) return null;
    const e = enrichCard(card, links);
    const linked = links
      .filter((l) => l.type === 'solid' && (l.a === card.id || l.b === card.id))
      .map((l) => cards.find((c) => c.id === otherEnd(l, card.id)))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ id: c.id, title: c.title, color: CARD_TYPES[c.type].color }));
    const aiLinks = links
      .filter((l) => l.type === 'ai' && (l.a === card.id || l.b === card.id))
      .map((l) => {
        const o = cards.find((c) => c.id === otherEnd(l, card.id));
        return o
          ? { id: o.id, a: l.a, b: l.b, title: o.title, color: CARD_TYPES[o.type].color, reason: l.reason ?? '' }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    return { e, linked, aiLinks };
  }, [card, cards, links]);

  if (!card || !view) {
    return <div style={{ padding: 24, color: '#b0b0b8', fontSize: 13 }}>沒有選取的卡片。</div>;
  }

  const { e, linked, aiLinks } = view;

  return (
    <div className="scrl" style={{ overflowY: 'auto', padding: '22px 24px 40px' }}>
      {/* header: type selector + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
        <TypeDot type={card.type} />
        <select
          value={card.type}
          onChange={(ev) => updateCard(card.id, { type: ev.target.value as CardType })}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 12,
            fontWeight: 700,
            color: e.color,
            cursor: 'pointer',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        >
          {CARD_TYPE_LIST.map((t) => (
            <option key={t} value={t}>
              {CARD_TYPES[t].label}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (confirm('刪除這張卡片？')) {
              deleteCard(card.id);
              onClose();
            }
          }}
          className="icon-btn icon-btn-danger"
          title="刪除卡片"
          style={{ width: 32, height: 32 }}
        >
          <TrashIcon size={16} />
        </button>
        <button onClick={onClose} className="icon-btn" title="關閉" style={{ width: 32, height: 32 }}>
          <CloseIcon size={17} />
        </button>
      </div>

      {/* title (editable) */}
      <input
        value={card.title}
        onChange={(ev) => updateCard(card.id, { title: ev.target.value })}
        placeholder="卡片標題"
        style={{
          width: '100%',
          fontSize: 21,
          fontWeight: 700,
          lineHeight: 1.4,
          marginBottom: 12,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          color: '#1d1d22',
        }}
      />

      {/* body (editable) */}
      <textarea
        value={card.body}
        onChange={(ev) => updateCard(card.id, { body: ev.target.value })}
        placeholder="寫下這張卡片的內容…"
        rows={Math.max(4, card.body.split('\n').length + 1)}
        style={{
          width: '100%',
          fontSize: 14,
          lineHeight: 1.85,
          color: '#3f3f48',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      <TagEditor
        tags={card.tags}
        onChange={(tags) => updateCard(card.id, { tags })}
      />

      {/* board membership */}
      {boards.some((b) => b.placements.some((p) => p.cardId === card.id)) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8a8a94', letterSpacing: 0.5, marginBottom: 8 }}>所在白板</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {boards
              .filter((b) => b.placements.some((p) => p.cardId === card.id))
              .map((b) => (
                <span
                  key={b.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3a5bd0', background: '#eef1fe', border: '1px solid #d4ddfb', padding: '3px 9px', borderRadius: 7 }}
                >
                  {b.name}
                  <button
                    onClick={() => removeCardFromBoard(b.id, card.id)}
                    className="reset-btn"
                    title="從這個白板移除"
                    style={{ color: '#7a90d8', fontSize: 13, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* bidirectional links */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8a8a94', letterSpacing: 0.5, marginBottom: 10 }}>
          雙向連結 · {linked.length}
        </div>
        {linked.map((lk) => (
          <button
            key={lk.id}
            onClick={() => selectCard(lk.id)}
            className="reset-btn hover-tint"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 12px',
              border: '1px solid rgba(0,0,0,.07)',
              borderRadius: 10,
              marginBottom: 8,
              width: '100%',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: lk.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a32', flex: 1 }}>{lk.title}</span>
            <span style={{ color: '#c0c0c8' }}>↗</span>
          </button>
        ))}
        {linked.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#b0b0b8', padding: '4px 0' }}>還沒有連結</div>
        )}
      </div>

      {/* AI suggested links */}
      {aiLinks.length > 0 && (
        <div
          style={{
            marginTop: 22,
            background: '#faf9ff',
            border: '1px solid #ece6fb',
            borderRadius: 13,
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#6438d6', marginBottom: 11 }}>
            <SparkleIcon size={14} />
            AI 建議連結
          </div>
          {aiLinks.map((al) => (
            <div
              key={al.id}
              style={{ background: '#fff', border: '1px solid #ece6fb', borderRadius: 10, padding: '11px 12px', marginBottom: 9 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: al.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2a2a32' }}>{al.title}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#9a9aa4', lineHeight: 1.5, marginBottom: 9 }}>{al.reason}</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button
                  onClick={() => acceptLink(al.a, al.b)}
                  className="reset-btn"
                  style={{ flex: 1, height: 30, background: '#6438d6', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  建立連結
                </button>
                <button
                  onClick={() => dismissLink(al.a, al.b)}
                  className="reset-btn"
                  style={{ height: 30, padding: '0 13px', border: '1px solid rgba(0,0,0,.1)', background: '#fff', color: '#8a8a94', borderRadius: 7, fontSize: 12 }}
                >
                  略過
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '18px 0 6px', alignItems: 'center' }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6a6a74', background: '#f4f3ef', padding: '3px 9px', borderRadius: 7 }}
        >
          #{tag}
          <button
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="reset-btn"
            style={{ color: '#b0b0b8', fontSize: 12, lineHeight: 1 }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        placeholder="+ 標籤"
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            const v = (ev.target as HTMLInputElement).value.trim().replace(/^#/, '');
            if (v && !tags.includes(v)) onChange([...tags, v]);
            (ev.target as HTMLInputElement).value = '';
          }
        }}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 12,
          width: 70,
          fontFamily: 'inherit',
          color: '#6a6a74',
        }}
      />
    </div>
  );
}
