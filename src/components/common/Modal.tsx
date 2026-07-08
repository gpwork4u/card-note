import type { ReactNode } from 'react';
import { useEscape } from '@/hooks/useKeyboard';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** vertical alignment of the dialog */
  align?: 'center' | 'top';
  zIndex?: number;
}

/** Centered dialog with a dimmed, blurred backdrop. Closes on backdrop click / Esc. */
export function Modal({ onClose, children, width = 560, align = 'center', zIndex = 85 }: ModalProps) {
  useEscape(onClose);
  return (
    <div
      onClick={onClose}
      className="anim-fadein"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,18,30,.32)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex,
        display: 'flex',
        alignItems: align === 'top' ? 'flex-start' : 'center',
        justifyContent: 'center',
        paddingTop: align === 'top' ? '11vh' : 0,
        padding: align === 'top' ? '11vh 16px 16px' : 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-pop"
        style={{
          width,
          maxWidth: '92vw',
          maxHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
