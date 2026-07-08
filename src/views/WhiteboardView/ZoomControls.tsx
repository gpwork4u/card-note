import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from '@/store';

const btn: CSSProperties = {
  width: 40,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  lineHeight: 1,
  color: '#55555f',
  cursor: 'pointer',
};

const mid: CSSProperties = {
  width: 40,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10.5,
  color: '#74747e',
  borderTop: '1px solid rgba(20,20,30,.07)',
  borderBottom: '1px solid rgba(20,20,30,.07)',
  cursor: 'pointer',
};

/** bottom-right zoom widget: +, current %, − (the % resets the view) */
export function ZoomControls() {
  const scale = useStore((s) => s.scale);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const zoomReset = useStore((s) => s.zoomReset);

  // swallow pointerdown so clicking the widget never starts a canvas pan
  const stop = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <div
      onPointerDown={stop}
      style={{
        position: 'absolute',
        bottom: 18,
        right: 18,
        background: '#fff',
        borderRadius: 11,
        border: '1px solid rgba(20,20,30,.08)',
        boxShadow: '0 2px 10px rgba(0,0,0,.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <button type="button" className="reset-btn" style={btn} onClick={zoomIn} aria-label="放大" title="放大">
        +
      </button>
      <button
        type="button"
        className="reset-btn mono"
        style={mid}
        onClick={zoomReset}
        aria-label="重設縮放"
        title="重設縮放"
      >
        {Math.round(scale * 100) + '%'}
      </button>
      <button type="button" className="reset-btn" style={btn} onClick={zoomOut} aria-label="縮小" title="縮小">
        &minus;
      </button>
    </div>
  );
}
