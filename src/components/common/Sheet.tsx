import type { ReactNode } from 'react';
import { useEscape } from '@/hooks/useKeyboard';

interface SheetProps {
  onClose: () => void;
  children: ReactNode;
  /** title shown in the grab handle bar */
  title?: ReactNode;
  zIndex?: number;
}

/** Full-width bottom sheet for mobile (detail / search / sync panels). */
export function Sheet({ onClose, children, title, zIndex = 90 }: SheetProps) {
  useEscape(onClose);
  return (
    <div
      onClick={onClose}
      className="anim-fadein"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,18,30,.32)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        zIndex,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '92vh',
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideup .24s cubic-bezier(.22,1,.36,1)',
          paddingBottom: 'var(--safe-bottom)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px 6px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: 8,
              width: 38,
              height: 4,
              borderRadius: 4,
              background: 'rgba(0,0,0,.14)',
            }}
          />
          {title && (
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{title}</div>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            className="reset-btn"
            style={{
              marginTop: 6,
              width: 30,
              height: 30,
              borderRadius: 8,
              background: '#f3f1ec',
              color: '#7a7a84',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <div className="scrl" style={{ overflowY: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
