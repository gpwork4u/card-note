import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Pencil, Archive, Trash2, LayoutList } from 'lucide-react';
import type { Board } from '@/types';
import { ContextMenu, type MenuItem } from '@/components/common/ContextMenu';

interface BoardTabsProps {
  /** every board, archived included — the row filters them itself */
  boards: Board[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** full board id order (visible tabs first, archived boards appended) */
  onReorder: (orderedIds: string[]) => void;
  onArchive: (id: string) => void;
  onManage: () => void;
}

/** movement (px) past which a press on a tab becomes a reorder drag */
const DRAG_THRESHOLD = 4;

/** which tab sits under a screen x within the row, if any */
function tabIdAt(row: HTMLElement | null, clientX: number): string | null {
  if (!row) return null;
  for (const el of row.querySelectorAll<HTMLElement>('[data-board-id]')) {
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right) return el.dataset.boardId ?? null;
  }
  return null;
}

/** whiteboard switcher row (styled after KanbanView's project tabs) */
export function BoardTabs({
  boards,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onReorder,
  onArchive,
  onManage,
}: BoardTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // in-flight reorder drag (state, not a ref: the row must re-render as it moves)
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; moved: boolean } | null>(null);
  // the authoritative in-flight order. `drag` state only drives rendering and
  // may still hold the previous value when pointerup lands right after a move.
  const dragOrderRef = useRef<string[]>([]);
  // a press that turned into a drag must not also fire the tab's click
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const visible = boards.filter((b) => !b.archived);
  const archivedCount = boards.length - visible.length;
  const byId = new Map(boards.map((b) => [b.id, b]));
  const displayIds = drag?.order ?? visible.map((b) => b.id);
  const ordered = displayIds.map((id) => byId.get(id)).filter((b): b is Board => !!b);

  const startEdit = (b: Board) => {
    setEditingId(b.id);
    setDraft(b.name);
  };
  const commit = () => {
    if (editingId) {
      const name = draft.trim();
      if (name) onRename(editingId, name);
    }
    setEditingId(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingId(null);
    }
  };

  // ---- reorder drag ------------------------------------------------------
  // Pointer-driven so it stays in one state machine, but mouse/pen only: the row
  // scrolls horizontally on touch, and claiming the gesture there would break
  // scrolling. Phones reorder from the board manager instead.

  const onTabPointerDown = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0 || e.pointerType === 'touch' || editingId) return;
    // a drag that ended over a different tab never delivers a click to the tab
    // it started on, so clear the flag here rather than relying on it being consumed
    suppressClickRef.current = false;
    dragRef.current = { id, pointerId: e.pointerId, startX: e.clientX, moved: false };
    try {
      rowRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
  };

  const onRowPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) <= DRAG_THRESHOLD) return;
      d.moved = true;
      dragOrderRef.current = visible.map((b) => b.id);
      setDrag({ id: d.id, order: dragOrderRef.current });
    }
    const overId = tabIdAt(rowRef.current, e.clientX);
    if (!overId || overId === d.id) return;
    const next = [...dragOrderRef.current];
    const from = next.indexOf(d.id);
    const to = next.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return;
    next.splice(from, 1);
    next.splice(to, 0, d.id);
    dragOrderRef.current = next;
    setDrag({ id: d.id, order: next });
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      rowRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* release is best-effort */
    }
    if (d.moved) {
      suppressClickRef.current = true;
      // read the ref, not `drag`: a pointerup right after the last move would
      // otherwise commit the order from before that move
      const finalOrder = dragOrderRef.current.length ? dragOrderRef.current : visible.map((b) => b.id);
      // archived boards keep their relative position after the visible ones
      onReorder([...finalOrder, ...boards.filter((b) => b.archived).map((b) => b.id)]);
    }
    dragOrderRef.current = [];
    setDrag(null);
  };

  const cancelDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    dragOrderRef.current = [];
    setDrag(null);
  };

  // ---- per-tab context menu ---------------------------------------------

  function menuItems(b: Board): MenuItem[] {
    return [
      { label: '重新命名', icon: <Pencil size={15} />, onClick: () => startEdit(b) },
      {
        label: '封存白板',
        icon: <Archive size={15} />,
        disabled: visible.length <= 1,
        onClick: () => onArchive(b.id),
      },
      { separator: true },
      {
        label: '刪除白板',
        icon: <Trash2 size={15} />,
        danger: true,
        disabled: boards.length <= 1,
        onClick: () => {
          if (window.confirm(`刪除白板「${b.name}」？（卡片本身不會被刪除）`)) onDelete(b.id);
        },
      },
    ];
  }

  const onTabContextMenu = (e: ReactMouseEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ id, x: e.clientX, y: e.clientY });
  };

  return (
    <div
      ref={rowRef}
      className="hscroll"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '12px 20px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,.06)',
        background: '#faf9f6',
      }}
      onPointerMove={onRowPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
    >
      {ordered.map((b) => {
        const active = b.id === activeId;
        const editing = editingId === b.id;
        const canDelete = !active && boards.length > 1;
        const dragging = drag?.id === b.id;
        return (
          <div
            key={b.id}
            data-board-id={b.id}
            style={{
              position: 'relative',
              flexShrink: 0,
              opacity: dragging ? 0.55 : 1,
              transition: drag ? 'none' : 'opacity .12s',
            }}
            onMouseEnter={() => setHoveredId(b.id)}
            onMouseLeave={() => setHoveredId((h) => (h === b.id ? null : h))}
            onPointerDown={(e) => onTabPointerDown(e, b.id)}
            onContextMenu={(e) => onTabContextMenu(e, b.id)}
          >
            <button
              type="button"
              className="reset-btn"
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (!editing) onSelect(b.id);
              }}
              onDoubleClick={() => {
                if (active) startEdit(b);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 34,
                padding: '0 14px',
                borderRadius: 10,
                border: active ? '1px solid #c9d4fb' : '1px solid rgba(0,0,0,.08)',
                background: active ? '#eef1fe' : '#fff',
                color: active ? '#2a3a8a' : '#6a6a74',
                fontSize: 13,
                fontWeight: 600,
                cursor: dragging ? 'grabbing' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {editing ? (
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={onKey}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    font: 'inherit',
                    fontWeight: 600,
                    color: '#2a3a8a',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: 0,
                    width: Math.max(48, draft.length * 9 + 4),
                  }}
                />
              ) : (
                <span>{b.name}</span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: '#a8a8b0',
                  background: 'rgba(0,0,0,.04)',
                  padding: '0 6px',
                  borderRadius: 6,
                }}
              >
                {b.placements.length}
              </span>
            </button>

            {canDelete && (
              <button
                type="button"
                className="reset-btn"
                title="刪除白板"
                aria-label={`刪除白板 ${b.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`刪除白板「${b.name}」？（卡片本身不會被刪除）`)) onDelete(b.id);
                }}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,.12)',
                  color: '#9a9aa4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: 'pointer',
                  opacity: hoveredId === b.id && !drag ? 1 : 0,
                  transition: 'opacity .12s',
                }}
              >
                &times;
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="reset-btn"
        onClick={onNew}
        style={{
          height: 34,
          padding: '0 13px',
          borderRadius: 10,
          border: '1px dashed rgba(0,0,0,.18)',
          background: 'transparent',
          color: '#8a8a94',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        + 新增白板
      </button>

      <button
        type="button"
        className="reset-btn"
        onClick={onManage}
        title="管理白板（排序、封存）"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 34,
          padding: '0 12px',
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,.08)',
          background: '#fff',
          color: '#6a6a74',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        <LayoutList size={15} />
        管理白板
        {archivedCount > 0 && (
          <span
            style={{
              fontSize: 11,
              color: '#a8a8b0',
              background: 'rgba(0,0,0,.04)',
              padding: '0 6px',
              borderRadius: 6,
            }}
          >
            已封存 {archivedCount}
          </span>
        )}
      </button>

      {menu && byId.has(menu.id) && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(byId.get(menu.id)!)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
