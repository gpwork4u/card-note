import { useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import { Modal } from '@/components/common/Modal';
import { SearchIcon } from '@/components/common/icons';
import type { Board } from '@/types';

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,.08)',
  background: '#fff',
};

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,.1)',
  background: '#fff',
  color: '#6a6a74',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function sectionTitle(text: string, count: number) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px', fontSize: 12, fontWeight: 700, color: '#8a8a94' }}>
      {text}
      <span style={{ fontWeight: 600, color: '#a8a8b0', background: 'rgba(0,0,0,.04)', padding: '0 6px', borderRadius: 6 }}>
        {count}
      </span>
    </div>
  );
}

/**
 * Board manager: reorder, archive and restore whiteboards.
 *
 * The tab row can be reordered by dragging on desktop, but that gesture is not
 * available on touch (the row scrolls horizontally there), so the up/down
 * buttons here are the only ordering path on a phone — keep them.
 */
export function BoardManagerModal() {
  const open = useStore((s) => s.boardManagerOpen);
  const close = useStore((s) => s.closeBoardManager);
  const boards = useStore((s) => s.boards);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const selectBoard = useStore((s) => s.selectBoard);
  const reorderBoards = useStore((s) => s.reorderBoards);
  const setBoardArchived = useStore((s) => s.setBoardArchived);
  const deleteBoard = useStore((s) => s.deleteBoard);

  const [q, setQ] = useState('');

  if (!open) return null;

  const visible = boards.filter((b) => !b.archived);
  const archived = boards.filter((b) => b.archived);
  const query = q.trim();
  const match = (b: Board) => !query || b.name.includes(query);
  const filtering = query.length > 0;

  /** move a visible board by one slot; archived boards keep their tail position */
  function move(id: string, delta: number) {
    const ids = visible.map((b) => b.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderBoards([...ids, ...archived.map((b) => b.id)]);
  }

  function remove(b: Board) {
    if (boards.length <= 1) return;
    if (window.confirm(`刪除白板「${b.name}」？（卡片本身不會被刪除）`)) deleteBoard(b.id);
  }

  function goTo(id: string) {
    selectBoard(id);
    setQ('');
    close();
  }

  return (
    <Modal
      onClose={() => {
        setQ('');
        close();
      }}
      width={520}
    >
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>管理白板</div>
        <div style={{ fontSize: 12, color: '#9a9aa4' }}>
          調整白板在分頁列的順序，把暫時用不到的白板封存起來。封存不會刪除任何卡片。
        </div>
      </div>

      <div style={{ padding: '12px 22px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10 }}>
          <SearchIcon size={16} style={{ color: '#a0a0a8' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋白板…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div className="scrl" style={{ flex: 1, overflowY: 'auto', padding: '0 22px 8px', maxHeight: '56vh' }}>
        {sectionTitle('使用中', visible.length)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.filter(match).map((b) => {
            const i = visible.indexOf(b);
            return (
              <div key={b.id} style={{ ...rowStyle, borderColor: b.id === activeBoardId ? '#c9d4fb' : 'rgba(0,0,0,.08)', background: b.id === activeBoardId ? '#eef1fe' : '#fff' }}>
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => goTo(b.id)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer' }}
                  title="切換到這個白板"
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2a2a32', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#9a9aa4' }}>{b.placements.length} 張卡片</div>
                </button>
                <button
                  type="button"
                  className="reset-btn"
                  style={{ ...iconBtnStyle, opacity: filtering || i === 0 ? 0.35 : 1 }}
                  disabled={filtering || i === 0}
                  title={filtering ? '搜尋中無法調整順序' : '上移'}
                  aria-label={`上移 ${b.name}`}
                  onClick={() => move(b.id, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="reset-btn"
                  style={{ ...iconBtnStyle, opacity: filtering || i === visible.length - 1 ? 0.35 : 1 }}
                  disabled={filtering || i === visible.length - 1}
                  title={filtering ? '搜尋中無法調整順序' : '下移'}
                  aria-label={`下移 ${b.name}`}
                  onClick={() => move(b.id, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="reset-btn"
                  style={{ ...iconBtnStyle, opacity: visible.length <= 1 ? 0.35 : 1 }}
                  disabled={visible.length <= 1}
                  title={visible.length <= 1 ? '至少要保留一個使用中的白板' : '封存'}
                  aria-label={`封存 ${b.name}`}
                  onClick={() => setBoardArchived(b.id, true)}
                >
                  <Archive size={15} />
                </button>
                <button
                  type="button"
                  className="reset-btn"
                  style={{ ...iconBtnStyle, color: '#e03131', opacity: boards.length <= 1 ? 0.35 : 1 }}
                  disabled={boards.length <= 1}
                  title="刪除白板"
                  aria-label={`刪除白板 ${b.name}`}
                  onClick={() => remove(b)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          {visible.filter(match).length === 0 && (
            <div style={{ fontSize: 13, color: '#b0b0b8', padding: '10px 0' }}>沒有符合的白板</div>
          )}
        </div>

        {archived.length > 0 && (
          <>
            {sectionTitle('已封存', archived.length)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {archived.filter(match).map((b) => (
                <div key={b.id} style={{ ...rowStyle, background: '#faf9f6' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#6a6a74', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#a8a8b0' }}>{b.placements.length} 張卡片</div>
                  </div>
                  <button
                    type="button"
                    className="reset-btn"
                    style={iconBtnStyle}
                    title="取消封存"
                    aria-label={`取消封存 ${b.name}`}
                    onClick={() => setBoardArchived(b.id, false)}
                  >
                    <ArchiveRestore size={15} />
                  </button>
                  <button
                    type="button"
                    className="reset-btn"
                    style={{ ...iconBtnStyle, color: '#e03131' }}
                    title="刪除白板"
                    aria-label={`刪除白板 ${b.name}`}
                    onClick={() => remove(b)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {archived.filter(match).length === 0 && (
                <div style={{ fontSize: 13, color: '#b0b0b8', padding: '10px 0' }}>沒有符合的白板</div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,.07)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            setQ('');
            close();
          }}
          className="reset-btn"
          style={{ height: 38, padding: '0 20px', borderRadius: 10, background: '#1b1b22', color: '#fff', fontSize: 13.5, fontWeight: 700 }}
        >
          完成
        </button>
      </div>
    </Modal>
  );
}
