import { useState } from 'react';
import { Columns3, X } from 'lucide-react';
import { useStore } from '@/store';
import type { KanbanColumn } from '@/types';
import { enrichCard } from '@/lib/derive';
import { KANBAN_COLUMNS } from '@/lib/tokens';
import { TypeDot } from '@/components/common/CardTypeBadge';
import { ContextMenu, type MenuItem } from '@/components/common/ContextMenu';
import { editItem, changeTypeItem, addToBoardItem, deleteItem } from '@/lib/cardMenu';
import { useLongPress } from '@/hooks/useLongPress';

/** card shape after enrichment (color / typeLabel / link counts attached) */
export type EnrichedCard = ReturnType<typeof enrichCard>;

interface KanbanCardItemProps {
  card: EnrichedCard;
  /** the column this card currently lives in */
  currentCol: KanbanColumn;
  projectId: string;
}

/**
 * A single kanban card.
 * - desktop: HTML5 drag source (drag onto another column to move)
 * - touch / universal fallback: tiny segmented column-switch controls at the bottom
 */
export function KanbanCardItem({ card, currentCol, projectId }: KanbanCardItemProps) {
  const moveKanbanCard = useStore((s) => s.moveKanbanCard);
  const selectCard = useStore((s) => s.selectCard);
  const [dragging, setDragging] = useState(false);

  const move = (to: KanbanColumn) => {
    if (to !== currentCol) moveKanbanCard(projectId, card.id, currentCol, to);
  };

  const removeCardFromProject = useStore((s) => s.removeCardFromProject);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const lp = useLongPress((x, y) => setMenu({ x, y }));

  const buildMenu = (): MenuItem[] => [
    editItem(card.id),
    {
      label: '移動到',
      icon: <Columns3 size={15} />,
      submenu: KANBAN_COLUMNS.map((c) => ({ label: c.title, checked: c.id === currentCol, onClick: () => move(c.id) })),
    },
    changeTypeItem(card.id),
    addToBoardItem(card.id),
    { separator: true },
    { label: '從專案移除', icon: <X size={15} />, onClick: () => removeCardFromProject(projectId, card.id) },
    deleteItem(card.id),
  ];

  return (
    <>
    <button
      type="button"
      className="reset-btn hover-tint"
      draggable
      onClick={() => {
        if (lp.consumeClick()) return;
        selectCard(card.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      {...lp.handlers}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({ cardId: card.id, from: currentCol }),
        );
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 10,
        padding: '12px 13px',
        cursor: 'pointer',
        width: '100%',
        display: 'block',
        opacity: dragging ? 0.45 : 1,
        transition: 'opacity .12s, background .12s, border-color .12s',
      }}
    >
      {/* header: type dot + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TypeDot type={card.type} size={9} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: card.color, letterSpacing: 0.3 }}>
          {card.typeLabel}
        </span>
      </div>

      {/* title */}
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginTop: 5, color: '#2c2c33' }}>
        {card.title}
      </div>

      {/* tags */}
      {card.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {card.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                color: '#9a9aa4',
                background: '#f4f3ef',
                padding: '1px 6px',
                borderRadius: 5,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* low-key column-switch controls (touch / accessibility fallback for drag) */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginTop: 9,
          paddingTop: 8,
          borderTop: '1px solid rgba(0,0,0,.05)',
        }}
      >
        {KANBAN_COLUMNS.map((c) => {
          const active = c.id === currentCol;
          return (
            <span
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`移至${c.title}`}
              title={`移至${c.title}`}
              onClick={(e) => {
                e.stopPropagation();
                move(c.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  move(c.id);
                }
              }}
              style={{
                fontSize: 9.5,
                lineHeight: 1.4,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 5,
                cursor: active ? 'default' : 'pointer',
                userSelect: 'none',
                background: active ? c.color : 'transparent',
                color: active ? '#fff' : '#b4b4bc',
                border: active ? '1px solid transparent' : '1px solid rgba(0,0,0,.08)',
              }}
            >
              {c.title[0]}
            </span>
          );
        })}
      </div>
    </button>
    {menu && <ContextMenu x={menu.x} y={menu.y} items={buildMenu()} onClose={() => setMenu(null)} />}
    </>
  );
}
