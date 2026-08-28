import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store';
import type { Board } from '@/types';

const board = (id: string, over: Partial<Board> = {}): Board => ({
  id,
  name: id,
  placements: [],
  ...over,
});

function setBoards(boards: Board[], activeBoardId: string | null = boards[0]?.id ?? null) {
  useStore.setState({ boards, activeBoardId });
}

const ids = () => useStore.getState().boards.map((b) => b.id);
const orders = () => useStore.getState().boards.map((b) => b.order);
const active = () => useStore.getState().activeBoardId;

beforeEach(() => {
  setBoards([board('b1'), board('b2'), board('b3')]);
});

describe('reorderBoards', () => {
  it('依傳入順序重排並指派連續的 order', () => {
    useStore.getState().reorderBoards(['b3', 'b1', 'b2']);
    expect(ids()).toEqual(['b3', 'b1', 'b2']);
    expect(orders()).toEqual([0, 1, 2]);
  });

  it('沒被列出的白板保持相對順序、接在後面', () => {
    useStore.getState().reorderBoards(['b3']);
    expect(ids()).toEqual(['b3', 'b1', 'b2']);
  });

  it('忽略不存在與重複的 id', () => {
    useStore.getState().reorderBoards(['b2', 'b2', 'nope', 'b1']);
    expect(ids()).toEqual(['b2', 'b1', 'b3']);
  });
});

describe('setBoardArchived', () => {
  it('封存目前所在的白板時會切到第一個未封存的白板', () => {
    setBoards([board('b1'), board('b2'), board('b3')], 'b1');
    useStore.getState().setBoardArchived('b1', true);
    expect(active()).toBe('b2');
  });

  it('封存別的白板不會影響目前所在的白板', () => {
    setBoards([board('b1'), board('b2')], 'b1');
    useStore.getState().setBoardArchived('b2', true);
    expect(active()).toBe('b1');
  });

  it('取消封存會移除 archived 欄位而不是存成 false', () => {
    setBoards([board('b1'), board('b2', { archived: true })], 'b1');
    useStore.getState().setBoardArchived('b2', false);
    const b2 = useStore.getState().boards.find((b) => b.id === 'b2')!;
    expect('archived' in b2).toBe(false);
  });

  it('全部封存時 activeBoardId 變成 null（白板視圖會顯示引導文字）', () => {
    setBoards([board('b1', { archived: true }), board('b2')], 'b2');
    useStore.getState().setBoardArchived('b2', true);
    expect(active()).toBeNull();
  });

  it('在沒有可見白板時取消封存，會自動選上它', () => {
    setBoards([board('b1', { archived: true })], null);
    useStore.getState().setBoardArchived('b1', false);
    expect(active()).toBe('b1');
  });
});

describe('createBoard / deleteBoard 與封存的互動', () => {
  it('新白板排在最後，順序重新正規化成連續名次（同步往返後位置才不會跑掉）', () => {
    setBoards([board('b1', { order: 0 }), board('b2', { order: 5 })]);
    const id = useStore.getState().createBoard('新白板');
    expect(ids()).toEqual(['b1', 'b2', id]);
    expect(orders()).toEqual([0, 1, 2]);
  });

  it('既有白板都還沒有 order 時，一併正規化，新白板不會跳到最前面', () => {
    // 只給新白板 order 的話，parseAll 會把「有 order」排在「沒有 order」之前，
    // 重載後剛建立的白板就跑到第一個去了。
    setBoards([board('b1'), board('b2')]);
    const id = useStore.getState().createBoard('新白板');
    expect(orders()).toEqual([0, 1, 2]);
    expect(ids()).toEqual(['b1', 'b2', id]);
  });

  it('刪除目前白板時只會落到未封存的白板上', () => {
    setBoards([board('b1'), board('b2', { archived: true }), board('b3')], 'b1');
    useStore.getState().deleteBoard('b1');
    expect(active()).toBe('b3');
  });
});

describe('hydrate', () => {
  it('遠端把目前所在的白板封存後，本機會切到未封存的白板', () => {
    setBoards([board('b1'), board('b2')], 'b1');
    useStore.getState().hydrate({ boards: [board('b1', { archived: true }), board('b2')] });
    expect(active()).toBe('b2');
  });

  it('目前白板仍未封存時不會被移動', () => {
    setBoards([board('b1'), board('b2')], 'b2');
    useStore.getState().hydrate({ boards: [board('b1'), board('b2')] });
    expect(active()).toBe('b2');
  });
});
