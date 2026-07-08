import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useEscape } from '@/hooks/useKeyboard';

export interface MenuItem {
  label?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  onClick?: () => void;
  submenu?: MenuItem[];
  /** render a divider line instead of an item */
  separator?: boolean;
}

const MENU_BOX: React.CSSProperties = {
  minWidth: 196,
  background: '#fff',
  border: '1px solid rgba(0,0,0,.08)',
  borderRadius: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,.16)',
  padding: 6,
  fontSize: 13,
};

function Row({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [subOpen, setSubOpen] = useState(false);
  const [side, setSide] = useState<'right' | 'left'>('right');
  const ref = useRef<HTMLDivElement>(null);

  if (item.separator) {
    return <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '5px 6px' }} />;
  }

  const hasSub = !!item.submenu?.length;
  const color = item.disabled ? '#c0c0c8' : item.danger ? '#e03131' : '#3a3a44';

  function openSub() {
    if (!hasSub) return;
    const r = ref.current?.getBoundingClientRect();
    if (r && r.right + 200 > window.innerWidth) setSide('left');
    else setSide('right');
    setSubOpen(true);
  }

  return (
    <div
      ref={ref}
      onMouseEnter={openSub}
      onMouseLeave={() => setSubOpen(false)}
      style={{ position: 'relative' }}
    >
      <button
        className="reset-btn"
        disabled={item.disabled}
        onClick={() => {
          if (item.disabled || hasSub) return;
          item.onClick?.();
          onClose();
        }}
        onMouseOver={(e) => {
          if (!item.disabled) e.currentTarget.style.background = item.danger ? '#fdecec' : '#f3f1ec';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          width: '100%',
          height: 32,
          padding: '0 9px',
          borderRadius: 8,
          color,
          background: 'transparent',
          cursor: item.disabled ? 'default' : 'pointer',
        }}
      >
        <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.disabled ? '#c8c8d0' : item.danger ? '#e03131' : '#8a8a94', flexShrink: 0 }}>
          {item.icon}
        </span>
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>{item.label}</span>
        {item.checked && <span style={{ color: '#4263eb', fontSize: 12 }}>✓</span>}
        {hasSub && <span style={{ color: '#b0b0b8', fontSize: 14 }}>›</span>}
      </button>

      {hasSub && subOpen && (
        <div
          style={{
            position: 'absolute',
            top: -6,
            ...(side === 'right' ? { left: '100%', marginLeft: 2 } : { right: '100%', marginRight: 2 }),
            ...MENU_BOX,
          }}
        >
          {item.submenu!.map((s, i) => (
            <Row key={i} item={s} onClose={onClose} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A positioned right-click menu. Closes on outside pointer-down, right-click, or Esc. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  useEscape(onClose);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // keep the menu inside the viewport (flip away from right/bottom edges)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + r.width > window.innerWidth - 8) nx = Math.max(8, window.innerWidth - r.width - 8);
    if (y + r.height > window.innerHeight - 8) ny = Math.max(8, window.innerHeight - r.height - 8);
    setPos({ x: nx, y: ny });
  }, [x, y, items]);

  return (
    <>
      <div
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 100 }}
      />
      <div
        ref={ref}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 101, ...MENU_BOX }}
      >
        {items.map((it, i) => (
          <Row key={i} item={it} onClose={onClose} />
        ))}
      </div>
    </>
  );
}
