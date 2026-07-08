import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { PlusIcon } from '@/components/common/icons';

interface Actions {
  onAddCard: () => void;
  onAddExisting: () => void;
}

const baseBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 13px',
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0,0,0,.06)',
  whiteSpace: 'nowrap',
};

const primaryBtn: CSSProperties = {
  ...baseBtn,
  background: '#4263eb',
  border: '1px solid #4263eb',
  color: '#fff',
};

const secondaryBtn: CSSProperties = {
  ...baseBtn,
  background: '#fff',
  border: '1px solid rgba(0,0,0,.1)',
  color: '#55555f',
};

function ActionButton({
  onClick,
  primary,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className="reset-btn" onClick={onClick} style={primary ? primaryBtn : secondaryBtn}>
      {children}
    </button>
  );
}

/** stop a press on the buttons from starting a canvas pan */
const stopPan = (e: ReactPointerEvent) => e.stopPropagation();

function Buttons({ onAddCard, onAddExisting }: Actions) {
  return (
    <>
      <ActionButton primary onClick={onAddCard}>
        <PlusIcon size={14} /> 新增卡片
      </ActionButton>
      <ActionButton onClick={onAddExisting}>加入既有卡片</ActionButton>
    </>
  );
}

/** small absolute toolbar pinned to the canvas's top-left */
export function CanvasToolbar({ onAddCard, onAddExisting }: Actions) {
  return (
    <div
      onPointerDown={stopPan}
      style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8, zIndex: 2 }}
    >
      <Buttons onAddCard={onAddCard} onAddExisting={onAddExisting} />
    </div>
  );
}

/** centered empty state shown when the active board has no cards */
export function EmptyBoard({ onAddCard, onAddExisting }: Actions) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 14, color: '#9a9aa4' }}>這個白板還沒有卡片</div>
      <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto' }} onPointerDown={stopPan}>
        <Buttons onAddCard={onAddCard} onAddExisting={onAddExisting} />
      </div>
    </div>
  );
}
