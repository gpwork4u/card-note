import {
  memo,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Card, Link } from '@/types';
import { CARD_W } from '@/lib/tokens';
import { enrichCard } from '@/lib/derive';
import { LinkIcon } from '@/components/common/icons';
import { TypeDot } from '@/components/common/CardTypeBadge';

interface CardNodeProps {
  card: Card;
  /** board-specific position of this card (from the placement) */
  x: number;
  y: number;
  links: Link[];
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>, cardId: string, x: number, y: number) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>, cardId: string) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: ReactMouseEvent<HTMLDivElement>, cardId: string) => void;
}

function CardNodeBase({
  card,
  x,
  y,
  links,
  selected,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
}: CardNodeProps) {
  // enrich locally so re-renders are scoped: this only recomputes when the card
  // object or the links array reference changes (handled by the memo wrapper).
  const ec = useMemo(() => enrichCard(card, links), [card, links]);
  const { color, typeLabel, linkCount, hasLinks } = ec;

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, card.id, x, y)}
      onPointerUp={(e) => onPointerUp(e, card.id)}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, card.id);
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CARD_W,
        background: '#fff',
        borderRadius: 14,
        padding: '14px 15px',
        border: selected ? `2px solid ${color}` : '1px solid rgba(20,20,30,.09)',
        boxShadow: selected
          ? `0 10px 30px ${color}33`
          : '0 1px 2px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.06)',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <TypeDot type={card.type} />
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.3 }}>{typeLabel}</span>
        <span style={{ flex: 1 }} />
        {hasLinks && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10.5,
              color: '#b0b0b8',
            }}
          >
            <LinkIcon />
            {linkCount}
          </span>
        )}
      </div>

      {/* title */}
      <div
        style={{
          fontSize: 14.5,
          fontWeight: 700,
          lineHeight: 1.35,
          marginBottom: 6,
          color: '#1d1d22',
        }}
      >
        {card.title}
      </div>

      {/* body — clamped to 3 lines */}
      {card.body && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.55,
            color: '#74747e',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.body}
        </div>
      )}

      {/* tags */}
      {card.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {card.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10.5,
                color: '#8a8a94',
                background: '#f1f0ec',
                padding: '2px 7px',
                borderRadius: 6,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Memoised so a drag (which only changes the moved card's object reference)
 * re-renders just that card, not every card on the board.
 */
export const CardNode = memo(CardNodeBase);
