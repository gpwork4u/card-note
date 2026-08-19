import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Pencil, Palette, Copy, Trash2, RotateCcw, Plus, Download, Unlink } from 'lucide-react';
import { useStore } from '@/store';
import { boardView } from '@/lib/derive';
import { CARD_TYPES, CARD_TYPE_LIST } from '@/lib/tokens';
import { ContextMenu, type MenuItem } from '@/components/common/ContextMenu';
import { CardNode } from './CardNode';
import { LinksLayer } from './LinksLayer';
import { ZoomControls } from './ZoomControls';
import { Hint } from './Hint';
import { BoardTabs } from './BoardTabs';
import { CanvasToolbar, EmptyBoard } from './CanvasToolbar';

// scale is clamped to this range everywhere (matches the store's zoomIn/zoomOut)
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.6;
// movement (px) past which a press is treated as a drag rather than a click
const MOVE_THRESHOLD = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface PointerPt {
  x: number;
  y: number;
}

/** drop a finished/cancelled pointer from tracking and release its capture */
function releasePointer(map: Map<number, PointerPt>, e: ReactPointerEvent<HTMLDivElement>) {
  map.delete(e.pointerId);
  try {
    e.currentTarget.releasePointerCapture(e.pointerId);
  } catch {
    /* capture release is best-effort */
  }
}

/** the in-flight gesture; null when idle. discriminated by `kind`. */
type Gesture =
  | { kind: 'pan'; pointerId: number; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | {
      kind: 'drag';
      pointerId: number;
      id: string;
      sx: number;
      sy: number;
      ox: number;
      oy: number;
      moved: boolean;
    }
  | { kind: 'pinch'; startDist: number; startScale: number }
  | { kind: 'link'; pointerId: number; fromId: string }
  | null;

/** which card sits under a screen point, if any (hit-tests the real DOM boxes,
 *  so it stays correct whatever height a card's clamped body gives it) */
function cardIdAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  const node = el instanceof Element ? el.closest<HTMLElement>('[data-card-id]') : null;
  return node?.dataset.cardId ?? null;
}

/** which right-click / long-press menu is open, and where */
type MenuState =
  | { kind: 'canvas'; x: number; y: number; world?: { x: number; y: number } }
  | { kind: 'card'; x: number; y: number; cardId: string }
  | { kind: 'link'; x: number; y: number; link: { a: string; b: string } };

/** < 640px → phone (self-contained matchMedia hook, no external hook import) */
function useIsPhone(): boolean {
  const query = '(max-width: 639px)';
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setPhone(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return phone;
}

export default function WhiteboardView() {
  const cards = useStore((s) => s.cards);
  const links = useStore((s) => s.links);
  const boards = useStore((s) => s.boards);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const pan = useStore((s) => s.pan);
  const scale = useStore((s) => s.scale);
  const selectedId = useStore((s) => s.selectedId);
  const isPhone = useIsPhone();

  // board actions (stable references — safe to pass straight down)
  const selectBoard = useStore((s) => s.selectBoard);
  const createBoard = useStore((s) => s.createBoard);
  const renameBoard = useStore((s) => s.renameBoard);
  const deleteBoard = useStore((s) => s.deleteBoard);
  const openAddToBoard = useStore((s) => s.openAddToBoard);

  // resolve the active board into the cards it places + the links between them
  const board = boards.find((b) => b.id === activeBoardId) ?? null;
  const { placed, boardLinks } = boardView(board, cards, links);

  const canvasRef = useRef<HTMLDivElement>(null);
  // mutable gesture state kept in refs so pointer handlers never go stale and
  // don't trigger renders on every move.
  const gestureRef = useRef<Gesture>(null);
  const pointersRef = useRef<Map<number, PointerPt>>(new Map());
  const longPressRef = useRef<number | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  // in-flight drag-to-connect (state, not a ref: the preview line must re-render)
  const [linking, setLinking] = useState<{
    fromId: string;
    to: { x: number; y: number };
    targetId: string | null;
  } | null>(null);

  /** screen point → board (world) coordinates, undoing pan + zoom */
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const { pan: p, scale: s } = useStore.getState();
    return {
      x: (clientX - (rect?.left ?? 0) - p.x) / s,
      y: (clientY - (rect?.top ?? 0) - p.y) / s,
    };
  }, []);

  // ---- touch long-press (opens the context menu where there is no right-click)

  const clearLongPress = useCallback(() => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (kind: 'canvas' | 'card', clientX: number, clientY: number, cardId?: string) => {
      clearLongPress();
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        // abandon any pending pan/drag so the long-press isn't also read as a tap
        gestureRef.current = null;
        pointersRef.current.clear();
        setGrabbing(false);
        if (kind === 'card' && cardId) {
          setMenu({ kind: 'card', cardId, x: clientX, y: clientY });
          return;
        }
        setMenu({ kind: 'canvas', x: clientX, y: clientY, world: toWorld(clientX, clientY) });
      }, 480);
    },
    [clearLongPress, toWorld],
  );

  // ---- gesture helpers -------------------------------------------------

  const startPinch = useCallback(() => {
    clearLongPress();
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [p1, p2] = pts;
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    gestureRef.current = {
      kind: 'pinch',
      startDist: d || 1,
      startScale: useStore.getState().scale,
    };
    setGrabbing(false);
  }, [clearLongPress]);

  // resolve the gesture after a finger lifts during a pinch: keep pinching while
  // two remain; with one left, hand control to a fresh pan so "pinch then keep
  // one finger down to drag" works; otherwise go idle.
  const settlePinchEnd = useCallback(() => {
    const remaining = [...pointersRef.current.entries()];
    if (remaining.length >= 2) {
      // reset the pinch baseline so the surviving pair doesn't cause a jump
      const [, p1] = remaining[0];
      const [, p2] = remaining[1];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      gestureRef.current = { kind: 'pinch', startDist: d || 1, startScale: useStore.getState().scale };
      return;
    }
    if (remaining.length === 1) {
      const [pid, pt] = remaining[0];
      const { pan: p } = useStore.getState();
      gestureRef.current = {
        kind: 'pan',
        pointerId: pid,
        sx: pt.x,
        sy: pt.y,
        ox: p.x,
        oy: p.y,
        moved: false,
      };
      setGrabbing(true);
      return;
    }
    gestureRef.current = null;
    setGrabbing(false);
  }, []);

  // ---- card pointer handlers (passed down to CardNode) -----------------

  const onCardPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, cardId: string, x: number, y: number) => {
      // ignore non-primary buttons (right/middle) — those drive the context menu
      if (e.button !== 0) return;
      e.stopPropagation();
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      if (pointersRef.current.size >= 2) {
        startPinch();
        return;
      }
      // ox/oy are the card's current placement position on the active board
      gestureRef.current = {
        kind: 'drag',
        pointerId: e.pointerId,
        id: cardId,
        sx: e.clientX,
        sy: e.clientY,
        ox: x,
        oy: y,
        moved: false,
      };
      if (e.pointerType === 'touch') startLongPress('card', e.clientX, e.clientY, cardId);
    },
    [startPinch, startLongPress],
  );

  /**
   * Press on a card's link handle → start dragging a connection.
   *
   * Capture goes on the CANVAS, not the handle: with capture on the handle,
   * every later move/up would retarget into CardNode, whose own pointerup
   * stops propagation and would swallow the drop. Capturing on the canvas
   * keeps the whole gesture in this one state machine.
   */
  const onLinkStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, cardId: string) => {
      if (e.button !== 0) return;
      e.stopPropagation(); // must not also start a card drag
      e.preventDefault();
      clearLongPress();
      try {
        canvasRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      gestureRef.current = { kind: 'link', pointerId: e.pointerId, fromId: cardId };
      setLinking({ fromId: cardId, to: toWorld(e.clientX, e.clientY), targetId: null });
    },
    [clearLongPress, toWorld],
  );

  /** finish a link drag: connect when dropped on another card, otherwise cancel */
  const endLink = useCallback((g: { fromId: string }, clientX: number, clientY: number) => {
    const target = cardIdAt(clientX, clientY);
    // addLink already ignores self-links and de-dupes, but checking here keeps
    // a drop back onto the source from counting as a real action
    if (target && target !== g.fromId) useStore.getState().addLink(g.fromId, target);
    gestureRef.current = null;
    setLinking(null);
  }, []);

  const onCardPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, cardId: string) => {
      e.stopPropagation();
      clearLongPress();
      releasePointer(pointersRef.current, e);
      const g = gestureRef.current;
      if (!g) return;
      if (g.kind === 'pinch') {
        settlePinchEnd();
        return;
      }
      if (g.kind === 'drag' && g.pointerId === e.pointerId) {
        // a press that never crossed the move threshold opens the card
        if (!g.moved) useStore.getState().selectCard(cardId);
        gestureRef.current = null;
        return;
      }
      // the lifted finger drove a pan (e.g. a pan rebuilt after a pinch) — clear it
      if (g.pointerId === e.pointerId) {
        gestureRef.current = null;
        setGrabbing(false);
      }
    },
    [settlePinchEnd, clearLongPress],
  );

  // pointercancel (system gesture / long-press menu interrupt): clean up only,
  // never fire a tap action, so tracking can't leak into the next gesture.
  const onCardPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      clearLongPress();
      releasePointer(pointersRef.current, e);
      const g = gestureRef.current;
      if (!g) return;
      if (g.kind === 'pinch') {
        settlePinchEnd();
        return;
      }
      if (g.pointerId === e.pointerId) {
        gestureRef.current = null;
        setGrabbing(false);
      }
    },
    [settlePinchEnd, clearLongPress],
  );

  // ---- canvas (background) pointer handlers ----------------------------

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // ignore non-primary buttons (right/middle) — those drive the context menu
      if (e.button !== 0) return;
      // a link drag owns the canvas until it ends; a second finger must not
      // turn it into a pan or pinch
      if (gestureRef.current?.kind === 'link') return;
      // cards stopPropagation, so anything reaching here is the background
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (pointersRef.current.size >= 2) {
        startPinch();
        return;
      }
      const { pan: p } = useStore.getState();
      gestureRef.current = {
        kind: 'pan',
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        ox: p.x,
        oy: p.y,
        moved: false,
      };
      setGrabbing(true);
      if (e.pointerType === 'touch') startLongPress('canvas', e.clientX, e.clientY);
    },
    [startPinch, startLongPress],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const g = gestureRef.current;
    if (!g) return;

    if (g.kind === 'link') {
      if (g.pointerId !== e.pointerId) return;
      const over = cardIdAt(e.clientX, e.clientY);
      setLinking({
        fromId: g.fromId,
        to: toWorld(e.clientX, e.clientY),
        targetId: over && over !== g.fromId ? over : null,
      });
      return;
    }

    if (g.kind === 'pinch') {
      const pts = [...pointersRef.current.values()];
      if (pts.length < 2) return;
      const [p1, p2] = pts;
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const applied = Math.round(clamp((g.startScale * d) / g.startDist, MIN_SCALE, MAX_SCALE) * 100) / 100;
      const { pan: p, scale: s } = useStore.getState();
      if (applied === s) return;
      // anchor the midpoint between the fingers (transformOrigin is 0,0, so we
      // must compensate pan exactly like the wheel handler does)
      const rect = canvasRef.current?.getBoundingClientRect();
      const mx = (p1.x + p2.x) / 2 - (rect ? rect.left : 0);
      const my = (p1.y + p2.y) / 2 - (rect ? rect.top : 0);
      const wx = (mx - p.x) / s;
      const wy = (my - p.y) / s;
      useStore.getState().setScale(applied);
      useStore.getState().setPan({ x: mx - wx * applied, y: my - wy * applied });
      return;
    }

    if (g.kind === 'drag') {
      // threshold in screen px so it doesn't depend on zoom level
      const dxScreen = e.clientX - g.sx;
      const dyScreen = e.clientY - g.sy;
      if (!g.moved && Math.abs(dxScreen) + Math.abs(dyScreen) > MOVE_THRESHOLD) {
        g.moved = true;
        clearLongPress(); // a real drag cancels the pending long-press menu
      }
      // only actually move once it's a real drag, so a tap never nudges the card
      if (g.moved) {
        const { scale: s, activeBoardId: bid } = useStore.getState();
        // bid is non-null here: you can only drag a card that's on the active board
        if (bid) useStore.getState().moveCardOnBoard(bid, g.id, g.ox + dxScreen / s, g.oy + dyScreen / s);
      }
      return;
    }

    // pan
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (!g.moved && Math.abs(dx) + Math.abs(dy) > MOVE_THRESHOLD) {
      g.moved = true;
      clearLongPress(); // a real pan cancels the pending long-press menu
    }
    useStore.getState().setPan({ x: g.ox + dx, y: g.oy + dy });
  }, [clearLongPress, toWorld]);

  const endGesture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      clearLongPress();
      const g = gestureRef.current;
      if (g?.kind === 'link') {
        // don't releasePointer(): a link drag never entered pointersRef
        if (g.pointerId === e.pointerId) endLink(g, e.clientX, e.clientY);
        return;
      }
      releasePointer(pointersRef.current, e);
      if (!g) return;
      if (g.kind === 'pinch') {
        settlePinchEnd();
        return;
      }
      if (g.kind === 'pan' && g.pointerId === e.pointerId) {
        // a tap on empty space (no movement) clears the current selection
        if (!g.moved) useStore.getState().closeDetail();
        gestureRef.current = null;
        setGrabbing(false);
        return;
      }
      if (g.pointerId === e.pointerId) {
        // a drag whose pointer ended over the background — just clear it
        gestureRef.current = null;
        setGrabbing(false);
      }
    },
    [settlePinchEnd, clearLongPress, endLink],
  );

  // pointercancel on the canvas: pure cleanup, no tap actions (no closeDetail)
  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      clearLongPress();
      const g = gestureRef.current;
      if (g?.kind === 'link') {
        // cancelled, not dropped — abandon without creating a link
        if (g.pointerId === e.pointerId) {
          gestureRef.current = null;
          setLinking(null);
        }
        return;
      }
      releasePointer(pointersRef.current, e);
      if (!g) return;
      if (g.kind === 'pinch') {
        settlePinchEnd();
        return;
      }
      if (g.pointerId === e.pointerId) {
        gestureRef.current = null;
        setGrabbing(false);
      }
    },
    [settlePinchEnd, clearLongPress],
  );

  // ---- wheel zoom (native, non-passive so preventDefault works) ---------

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { pan: p, scale: s } = useStore.getState();
      const applied =
        Math.round(clamp(s * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE) * 1000) / 1000;
      if (applied === s) return;
      // keep the world point under the cursor fixed: pan compensation must use
      // the SAME (rounded) scale we actually apply, else the anchor drifts per tick
      const wx = (cx - p.x) / s;
      const wy = (cy - p.y) / s;
      useStore.getState().setScale(applied);
      useStore.getState().setPan({ x: cx - wx * applied, y: cy - wy * applied });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // clear any pending long-press timer when the view unmounts
  useEffect(() => clearLongPress, [clearLongPress]);

  // ---- toolbar actions --------------------------------------------------

  // create a fresh card at the world point currently centred in the viewport
  const onAddCard = useCallback(() => {
    const { activeBoardId: bid, pan: p, scale: s } = useStore.getState();
    if (!bid) return;
    const el = canvasRef.current;
    let pos: { x: number; y: number } | undefined;
    if (el) {
      const rect = el.getBoundingClientRect();
      pos = { x: (rect.width / 2 - p.x) / s, y: (rect.height / 2 - p.y) / s };
    }
    const id = useStore.getState().createCardOnBoard(bid, { title: '新卡片', type: 'idea', body: '' }, pos);
    useStore.getState().selectCard(id);
  }, []);

  // ---- context menu (right-click on desktop, long-press on touch) --------

  const onCanvasContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setMenu({ kind: 'canvas', x: e.clientX, y: e.clientY, world: toWorld(e.clientX, e.clientY) });
    },
    [toWorld],
  );

  // CardNode already did preventDefault + stopPropagation before calling this
  const onCardContextMenu = useCallback((e: ReactMouseEvent<HTMLDivElement>, cardId: string) => {
    setMenu({ kind: 'card', cardId, x: e.clientX, y: e.clientY });
  }, []);

  // LinksLayer already did preventDefault + stopPropagation before calling this
  const onLinkContextMenu = useCallback(
    (e: ReactMouseEvent<SVGPathElement>, link: { a: string; b: string }) => {
      setMenu({ kind: 'link', link, x: e.clientX, y: e.clientY });
    },
    [],
  );

  // assemble the menu items for whichever target was right-clicked
  function buildItems(m: MenuState): MenuItem[] {
    const get = useStore.getState;

    if (m.kind === 'canvas') {
      if (!activeBoardId) {
        return [{ label: '新增白板', icon: <Plus size={15} />, onClick: () => get().createBoard() }];
      }
      const bid = activeBoardId;
      return [
        {
          label: '在此新增卡片',
          icon: <Plus size={15} />,
          onClick: () => {
            const id = get().createCardOnBoard(bid, { title: '新卡片', type: 'idea', body: '' }, m.world);
            get().selectCard(id);
          },
        },
        { label: '加入既有卡片…', icon: <Download size={15} />, onClick: () => get().openAddToBoard() },
        { separator: true },
        { label: '重置視圖', icon: <RotateCcw size={15} />, onClick: () => get().zoomReset() },
      ];
    }

    if (m.kind === 'card') {
      const { cardId } = m;
      const card = cards.find((c) => c.id === cardId);
      const onActiveBoard = !!board?.placements.some((p) => p.cardId === cardId);

      const typeSub: MenuItem[] = CARD_TYPE_LIST.map((t) => ({
        label: CARD_TYPES[t].label,
        icon: (
          <span
            style={{ width: 9, height: 9, borderRadius: 3, background: CARD_TYPES[t].color, display: 'inline-block' }}
          />
        ),
        checked: card?.type === t,
        onClick: () => get().updateCard(cardId, { type: t }),
      }));

      const otherBoards = boards.filter((b) => !b.placements.some((p) => p.cardId === cardId));
      const copySub: MenuItem[] = otherBoards.length
        ? otherBoards.map((b) => ({ label: b.name, onClick: () => get().addCardToBoard(b.id, cardId) }))
        : [{ label: '（已在所有白板）', disabled: true }];

      const items: MenuItem[] = [
        { label: '編輯卡片', icon: <Pencil size={15} />, onClick: () => get().selectCard(cardId) },
        { label: '變更類型', icon: <Palette size={15} />, submenu: typeSub },
        { label: '複製到白板', icon: <Copy size={15} />, submenu: copySub },
        { separator: true },
      ];
      if (onActiveBoard && activeBoardId) {
        const bid = activeBoardId;
        items.push({
          label: '從此白板移除',
          icon: <Unlink size={15} />,
          onClick: () => get().removeCardFromBoard(bid, cardId),
        });
      }
      items.push({
        label: '刪除卡片',
        icon: <Trash2 size={15} />,
        danger: true,
        onClick: () => {
          if (window.confirm('刪除這張卡片？')) get().deleteCard(cardId);
        },
      });
      return items;
    }

    // link
    return [
      {
        label: '刪除連結',
        icon: <Unlink size={15} />,
        danger: true,
        onClick: () => get().removeLink(m.link.a, m.link.b),
      },
    ];
  }

  // ---- render -----------------------------------------------------------

  const canvasStyle: CSSProperties = {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    cursor: grabbing ? 'grabbing' : 'default',
    touchAction: 'none',
    background: '#f6f4ef',
    backgroundImage: 'radial-gradient(rgba(0,0,0,.10) 1.2px, transparent 1.2px)',
    backgroundSize: '26px 26px',
    backgroundPosition: `${pan.x}px ${pan.y}px`,
  };

  const worldStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: '0 0',
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
  };

  const hasCards = board !== null && placed.length > 0;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#f6f4ef' }}>
      <BoardTabs
        boards={boards}
        activeId={activeBoardId}
        onSelect={selectBoard}
        onNew={() => createBoard()}
        onRename={renameBoard}
        onDelete={deleteBoard}
      />

      <div
        ref={canvasRef}
        className="no-select"
        style={canvasStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerLeave={endGesture}
        onPointerCancel={onPointerCancel}
        onContextMenu={onCanvasContextMenu}
      >
        {hasCards && (
          <div style={worldStyle}>
            <LinksLayer
              placed={placed}
              links={boardLinks}
              onLinkContextMenu={onLinkContextMenu}
              pending={linking ? { fromId: linking.fromId, to: linking.to } : null}
            />
            {placed.map(({ card, x, y }) => (
              <CardNode
                key={card.id}
                card={card}
                x={x}
                y={y}
                links={links}
                selected={selectedId === card.id}
                onPointerDown={onCardPointerDown}
                onPointerUp={onCardPointerUp}
                onPointerCancel={onCardPointerCancel}
                onContextMenu={onCardContextMenu}
                onLinkStart={onLinkStart}
                linkSource={linking?.fromId === card.id}
                linkTarget={linking?.targetId === card.id}
              />
            ))}
          </div>
        )}

        {hasCards && <CanvasToolbar onAddCard={onAddCard} onAddExisting={openAddToBoard} />}
        {board !== null && placed.length === 0 && (
          <EmptyBoard onAddCard={onAddCard} onAddExisting={openAddToBoard} />
        )}
        {board === null && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#9a9aa4',
              pointerEvents: 'none',
            }}
          >
            請先用上方「＋ 新增白板」建立一個白板
          </div>
        )}

        <ZoomControls />
        {!isPhone && <Hint />}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={buildItems(menu)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
