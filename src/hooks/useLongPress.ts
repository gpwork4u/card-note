import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Long-press detection for touch (the mobile analogue of right-click). Mouse/pen
 * are ignored (they use the native contextmenu). Returns pointer handlers to spread
 * on the element plus `consumeClick()`, which the element's onClick should check
 * first so a long-press doesn't also fire the tap action.
 */
export function useLongPress(onLongPress: (clientX: number, clientY: number) => void, ms = 480) {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    startPos.current = null;
  };

  const handlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType !== 'touch') return;
      fired.current = false;
      const pos = { x: e.clientX, y: e.clientY };
      startPos.current = pos;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress(pos.x, pos.y);
        timer.current = null;
      }, ms);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (timer.current != null && startPos.current) {
        if (Math.abs(e.clientX - startPos.current.x) + Math.abs(e.clientY - startPos.current.y) > 8) clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };

  /** true if a long-press just fired — call in onClick to suppress the tap action */
  const consumeClick = () => {
    if (fired.current) {
      fired.current = false;
      return true;
    }
    return false;
  };

  return { handlers, consumeClick };
}
