import { useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import type { Card, Link } from '@/types';
import { cardCenter, linkPath, type Point } from '@/lib/bezier';
import { linkKey } from '@/lib/derive';

interface PlacedItem {
  card: Card;
  x: number;
  y: number;
}

interface LinksLayerProps {
  /** cards placed on the active board, with their board-specific positions */
  placed: PlacedItem[];
  /** links whose both ends are on this board (boardView's boardLinks) */
  links: Link[];
  /** right-click on a link → report which link was hit */
  onLinkContextMenu?: (e: ReactMouseEvent<SVGPathElement>, link: { a: string; b: string }) => void;
  /** in-flight drag-to-connect: preview line from a card to the pointer (world coords) */
  pending?: { fromId: string; to: Point } | null;
}

interface LinkStyle {
  stroke: string;
  width: number;
  dash: string;
  opacity: number;
}

const SOLID: LinkStyle = { stroke: '#c7cdde', width: 1.8, dash: 'none', opacity: 1 };
const AI: LinkStyle = { stroke: '#9775fa', width: 1.6, dash: '6 6', opacity: 0.9 };

/**
 * Bezier link layer. Lives inside the (panned/zoomed) world div but is offset
 * by a fixed margin so links that bow outside the card bounds aren't clipped.
 * Endpoints come from the board placements, not the cards themselves.
 */
export function LinksLayer({ placed, links, onLinkContextMenu, pending }: LinksLayerProps) {
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const p of placed) m.set(p.card.id, { x: p.x, y: p.y });
    return m;
  }, [placed]);

  return (
    <svg
      width={3600}
      height={2400}
      style={{
        position: 'absolute',
        left: -900,
        top: -700,
        overflow: 'visible',
        // the svg surface stays transparent to pointers (so panning works);
        // individual paths opt back in via pointerEvents:'stroke'
        pointerEvents: 'none',
      }}
    >
      <g transform="translate(900,700)">
        {links.map((link, i) => {
          const a = pos.get(link.a);
          const b = pos.get(link.b);
          if (!a || !b) return null;
          const s = link.type === 'ai' ? AI : SOLID;
          const d = linkPath(cardCenter(a), cardCenter(b));
          const key = `${link.a}__${link.b}__${i}`;
          const onCtx = onLinkContextMenu
            ? (e: ReactMouseEvent<SVGPathElement>) => {
                e.preventDefault();
                e.stopPropagation();
                onLinkContextMenu(e, { a: link.a, b: link.b });
              }
            : undefined;
          return (
            <g key={key}>
              {/* wide transparent hit area to make right-clicking the line easier */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                style={{ pointerEvents: 'stroke' }}
                onContextMenu={onCtx}
              />
              <path
                // canonical (order-independent) identity of this link
                data-link={linkKey(link.a, link.b)}
                data-link-type={link.type}
                d={d}
                fill="none"
                stroke={s.stroke}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                opacity={s.opacity}
                style={{ pointerEvents: 'stroke' }}
                onContextMenu={onCtx}
              />
            </g>
          );
        })}

        {/* drag-to-connect preview. pointerEvents must stay off: the drag
            hit-tests with elementFromPoint, and a live path under the cursor
            would mask the card being aimed at. */}
        {pending &&
          (() => {
            const from = pos.get(pending.fromId);
            if (!from) return null;
            return (
              <path
                d={linkPath(cardCenter(from), pending.to)}
                fill="none"
                stroke={AI.stroke}
                strokeWidth={2}
                strokeDasharray="5 5"
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}
      </g>
    </svg>
  );
}
