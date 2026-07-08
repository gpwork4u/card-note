import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { enrichCard } from '@/lib/derive';
import { SearchIcon, SparkleIcon } from '@/components/common/icons';
import { TypeDot } from '@/components/common/CardTypeBadge';
import { ContextMenu } from '@/components/common/ContextMenu';
import { cardMenu } from '@/lib/cardMenu';
import { useLongPress } from '@/hooks/useLongPress';

/** the shape enrichCard returns — derived locally to stay within the import whitelist */
type EnrichedCard = ReturnType<typeof enrichCard>;

/** < 640px → phone layout (self-contained matchMedia hook) */
function useIsPhone(): boolean {
  const query = '(max-width: 639px)';
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setPhone(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return phone;
}

export default function LibraryView() {
  const cards = useStore((s) => s.cards);
  const links = useStore((s) => s.links);
  const libQuery = useStore((s) => s.libQuery);
  const setLibQuery = useStore((s) => s.setLibQuery);
  const selectCard = useStore((s) => s.selectCard);
  const isPhone = useIsPhone();

  // all tags across cards, de-duplicated, original order preserved
  const allTags = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of cards) {
      for (const tag of c.tags) {
        if (!seen.has(tag)) {
          seen.add(tag);
          out.push(tag);
        }
      }
    }
    return out;
  }, [cards]);

  // filter, then enrich for rendering
  const visible = useMemo<EnrichedCard[]>(() => {
    const q = libQuery.trim();
    return cards
      .filter((c) => !q || (c.title + c.body + c.tags.join('')).includes(q))
      .map((c) => enrichCard(c, links));
  }, [cards, links, libQuery]);

  return (
    <div
      className="scrl"
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: isPhone ? '20px 16px 60px' : '26px 32px 60px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* 1. top row: search + AI pill */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              height: 42,
              padding: '0 14px',
              background: '#fff',
              border: '1px solid rgba(0,0,0,.09)',
              borderRadius: 11,
            }}
          >
            <SearchIcon size={17} style={{ stroke: '#a0a0a8', flexShrink: 0 }} />
            <input
              value={libQuery}
              onInput={(e) => setLibQuery(e.currentTarget.value)}
              placeholder="搜尋卡片、標籤、內容…"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 14,
                background: 'transparent',
              }}
            />
          </div>

          {!isPhone && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 42,
                padding: '0 13px',
                background: '#f3f0ff',
                border: '1px solid #e3dcfb',
                borderRadius: 11,
                color: '#6438d6',
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <SparkleIcon size={15} />
              <span>AI 已自動分類 {cards.length} 張</span>
            </div>
          )}
        </div>

        {/* 2. tag row */}
        {allTags.length > 0 && (
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                className="reset-btn"
                onClick={() => setLibQuery(tag)}
                style={{
                  fontSize: 12,
                  color: '#6a6a74',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,.07)',
                  padding: '4px 11px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* 3. card grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPhone
              ? '1fr'
              : 'repeat(auto-fill,minmax(250px,1fr))',
            gap: 14,
          }}
        >
          {visible.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onOpen={() => selectCard(card.id)}
            />
          ))}
        </div>

        {visible.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: '#9a9aa2',
              textAlign: 'center',
              padding: '48px 0',
            }}
          >
            沒有符合的卡片
          </div>
        )}
      </div>
    </div>
  );
}

function CardItem({ card, onOpen }: { card: EnrichedCard; onOpen: () => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const lp = useLongPress((x, y) => setMenu({ x, y }));
  return (
    <>
    <button
      className="reset-btn hover-raise"
      onClick={() => {
        if (lp.consumeClick()) return;
        onOpen();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      {...lp.handlers}
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,.08)',
        borderLeft: '3px solid ' + card.color,
        borderRadius: 12,
        padding: '15px 16px',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      {/* header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}
      >
        <TypeDot type={card.type} />
        <span style={{ fontSize: 11, fontWeight: 700, color: card.color }}>
          {card.typeLabel}
        </span>
        <span style={{ flex: 1 }} />
        {card.hasLinks && (
          <span style={{ fontSize: 10.5, color: '#b0b0b8' }}>
            ⛓ {card.linkCount}
          </span>
        )}
      </div>

      {/* title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.35,
          marginBottom: 6,
        }}
      >
        {card.title}
      </div>

      {/* body (3-line clamp) */}
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: '#80808a',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {card.body}
      </div>

      {/* tags */}
      {card.tags.length > 0 && (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}
        >
          {card.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10.5,
                color: '#8a8a94',
                background: '#f4f3ef',
                padding: '2px 7px',
                borderRadius: 6,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
    {menu && <ContextMenu x={menu.x} y={menu.y} items={cardMenu(card.id)} onClose={() => setMenu(null)} />}
    </>
  );
}
