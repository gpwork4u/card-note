import { useState } from 'react';
import { useStore } from '@/store';
import { CARD_TYPES } from '@/lib/tokens';
import { Modal } from '@/components/common/Modal';
import { SearchIcon } from '@/components/common/icons';

/** Pick existing library cards (not yet on the active board) and add them to it. */
export function AddToBoardModal() {
  const open = useStore((s) => s.addToBoardOpen);
  const close = useStore((s) => s.closeAddToBoard);
  const cards = useStore((s) => s.cards);
  const boards = useStore((s) => s.boards);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const addCardsToBoard = useStore((s) => s.addCardsToBoard);

  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');

  if (!open || !activeBoardId) return null;

  const board = boards.find((b) => b.id === activeBoardId);
  const onBoard = new Set(board?.placements.map((p) => p.cardId) ?? []);
  const query = q.trim();
  const available = cards.filter(
    (c) => !onBoard.has(c.id) && (!query || (c.title + c.body + c.tags.join('')).includes(query)),
  );

  function toggle(id: string) {
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function reset() {
    setSel([]);
    setQ('');
  }
  function add() {
    if (sel.length && activeBoardId) addCardsToBoard(activeBoardId, sel);
    reset();
    close();
  }

  return (
    <Modal
      onClose={() => {
        reset();
        close();
      }}
      width={560}
    >
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>加入既有卡片</div>
        <div style={{ fontSize: 12, color: '#9a9aa4' }}>
          從卡片庫挑選卡片放到「{board?.name}」白板上。
        </div>
      </div>

      <div style={{ padding: '12px 22px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 12px', background: '#fff', border: '1px solid rgba(0,0,0,.1)', borderRadius: 10 }}>
          <SearchIcon size={16} style={{ color: '#a0a0a8' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋卡片…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div className="scrl" style={{ flex: 1, overflowY: 'auto', padding: '8px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: '50vh' }}>
        {available.map((card) => {
          const on = sel.includes(card.id);
          const color = CARD_TYPES[card.type].color;
          return (
            <button
              key={card.id}
              onClick={() => toggle(card.id)}
              className="reset-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: on ? '1px solid #c9d4fb' : '1px solid rgba(0,0,0,.08)',
                background: on ? '#eef1fe' : '#fff',
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: on ? 'none' : '1.5px solid rgba(0,0,0,.2)', background: on ? '#4263eb' : '#fff', color: '#fff', fontSize: 12 }}>
                {on ? '✓' : ''}
              </span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2a2a32', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
                <div style={{ fontSize: 10.5, color: '#9a9aa4' }}>{CARD_TYPES[card.type].label}</div>
              </div>
            </button>
          );
        })}
        {available.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#b0b0b8', fontSize: 13, padding: '24px 0' }}>
            {query ? '沒有符合的卡片' : '所有卡片都已在這個白板上了'}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,.07)', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#7048e8', background: '#f3f0ff', padding: '2px 9px', borderRadius: 7, fontWeight: 600 }}>已選 {sel.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => { reset(); close(); }} className="reset-btn" style={{ height: 38, padding: '0 18px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', color: '#6a6a74', fontSize: 13.5, fontWeight: 600 }}>取消</button>
        <button onClick={add} disabled={sel.length === 0} className="reset-btn" style={{ height: 38, padding: '0 20px', borderRadius: 10, background: '#1b1b22', color: '#fff', fontSize: 13.5, fontWeight: 700, opacity: sel.length ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加入白板</button>
      </div>
    </Modal>
  );
}
