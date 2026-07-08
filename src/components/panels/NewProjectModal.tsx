import { useStore } from '@/store';
import { CARD_TYPES } from '@/lib/tokens';
import { Modal } from '@/components/common/Modal';

export function NewProjectModal() {
  const open = useStore((s) => s.newProjOpen);
  const close = useStore((s) => s.closeNewProj);
  const name = useStore((s) => s.newProjName);
  const setName = useStore((s) => s.setNewProjName);
  const sel = useStore((s) => s.newProjSel);
  const toggle = useStore((s) => s.toggleNewProjCard);
  const create = useStore((s) => s.createProject);
  const cards = useStore((s) => s.cards);

  if (!open) return null;

  return (
    <Modal onClose={close} width={560}>
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>新增專案</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="專案名稱，例如「新版白板上線」"
          autoFocus
          style={{ width: '100%', height: 42, padding: '0 14px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 11, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ padding: '14px 22px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3a3a44' }}>選擇要納入的卡片</span>
        <span style={{ fontSize: 12, color: '#7048e8', background: '#f3f0ff', padding: '1px 9px', borderRadius: 7, fontWeight: 600 }}>已選 {sel.length}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: '#a8a8b0' }}>之後可在看板拖動到各狀態</span>
      </div>

      <div className="scrl" style={{ flex: 1, overflowY: 'auto', padding: '6px 22px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {cards.map((card) => {
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
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: on ? 'none' : '1.5px solid rgba(0,0,0,.2)',
                  background: on ? '#4263eb' : '#fff',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
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
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,.07)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={close} className="reset-btn" style={{ height: 38, padding: '0 18px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', color: '#6a6a74', fontSize: 13.5, fontWeight: 600 }}>取消</button>
        <button onClick={create} className="reset-btn" style={{ height: 38, padding: '0 20px', borderRadius: 10, background: '#1b1b22', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>建立專案</button>
      </div>
    </Modal>
  );
}
