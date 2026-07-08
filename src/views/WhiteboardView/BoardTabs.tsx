import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Board } from '@/types';

interface BoardTabsProps {
  boards: Board[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/** whiteboard switcher row (styled after KanbanView's project tabs) */
export function BoardTabs({ boards, activeId, onSelect, onNew, onRename, onDelete }: BoardTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

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

  return (
    <div
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
    >
      {boards.map((b) => {
        const active = b.id === activeId;
        const editing = editingId === b.id;
        const canDelete = !active && boards.length > 1;
        return (
          <div
            key={b.id}
            style={{ position: 'relative', flexShrink: 0 }}
            onMouseEnter={() => setHoveredId(b.id)}
            onMouseLeave={() => setHoveredId((h) => (h === b.id ? null : h))}
          >
            <button
              type="button"
              className="reset-btn"
              onClick={() => {
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
                cursor: 'pointer',
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
                  opacity: hoveredId === b.id ? 1 : 0,
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
    </div>
  );
}
