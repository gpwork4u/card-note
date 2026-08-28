import { describe, expect, it } from 'vitest';
import { serializeBoard, parseBoard, parseAll, boardPath, type FileMap } from '@/serialization';
import { mergeBoardFiles, applyResolutions } from '@/sync/conflict';
import type { Board } from '@/types';

const base: Board = {
  id: 'b1',
  name: '白板一',
  placements: [{ cardId: 'c1', x: 10, y: 20 }],
};

function file(patch: Partial<Board>): string {
  return serializeBoard({ ...base, ...patch });
}

describe('board order/archived 序列化', () => {
  it('沒有 order/archived 的白板，輸出與加上這兩個欄位之前逐字相同', () => {
    // 這串是本功能加入「之前」serializeBoard 的輸出。舊資料 repo 的 31 個白板
    // 檔案在使用者實際排序／封存之前都不該被改寫，否則第一次同步會產生
    // 一份無意義的全檔 diff，也會和 iOS 端互相覆寫。
    const legacy = '{\n  "id": "b1",\n  "name": "白板一",\n  "placements": [\n    {\n      "cardId": "c1",\n      "x": 10,\n      "y": 20\n    }\n  ]\n}\n';
    expect(serializeBoard(base)).toBe(legacy);
  });

  it('archived=false 不寫入檔案（等同未封存）', () => {
    expect(serializeBoard({ ...base, archived: false })).toBe(serializeBoard(base));
  });

  it('order=0 會寫入（0 是有意義的值，不能當成空值省略）', () => {
    expect(serializeBoard({ ...base, order: 0 })).toContain('"order": 0');
  });

  it('order/archived round-trip', () => {
    const text = file({ order: 3, archived: true });
    const b = parseBoard(text, 'fallback');
    expect(b.order).toBe(3);
    expect(b.archived).toBe(true);
    expect(serializeBoard(b)).toBe(text);
  });

  it('order 非數字或 archived 非 true 一律忽略', () => {
    const b = parseBoard('{"id":"b1","name":"n","order":"3","archived":"yes","placements":[]}', 'fb');
    expect(b.order).toBeUndefined();
    expect(b.archived).toBeUndefined();
  });

  it('order 為小數時取整（欄位語意是名次）', () => {
    expect(parseBoard(file({ order: 2 }).replace('"order": 2', '"order": 2.6'), 'fb').order).toBe(3);
  });
});

describe('parseAll 的白板順序', () => {
  const mk = (id: string, order?: number): string =>
    serializeBoard({ id, name: id, placements: [], order });

  it('依 order 排序，與檔案列舉順序無關', () => {
    const files: FileMap = {
      [boardPath('bx')]: mk('bx', 2),
      [boardPath('ba')]: mk('ba', 0),
      [boardPath('bm')]: mk('bm', 1),
    };
    expect(parseAll(files).boards.map((b) => b.id)).toEqual(['ba', 'bm', 'bx']);
  });

  it('沒有 order 的白板排在有 order 的之後，並以 id 穩定定序', () => {
    const files: FileMap = {
      [boardPath('bz')]: mk('bz'),
      [boardPath('bb')]: mk('bb'),
      [boardPath('bo')]: mk('bo', 5),
    };
    expect(parseAll(files).boards.map((b) => b.id)).toEqual(['bo', 'bb', 'bz']);
  });
});

describe('mergeBoardFiles 對 order/archived 的處理', () => {
  it('只有本機排序 → 採本機', () => {
    const merged = mergeBoardFiles(file({}), file({ order: 2, name: '改名' }), file({}));
    expect(merged).not.toBeNull();
    expect(parseBoard(merged!, 'x').order).toBe(2);
  });

  it('只有遠端封存 → 採遠端', () => {
    const merged = mergeBoardFiles(
      file({}),
      file({ placements: [{ cardId: 'c1', x: 99, y: 99 }] }),
      file({ archived: true }),
    );
    expect(parseBoard(merged!, 'x').archived).toBe(true);
  });

  it('兩側排序不同 → 採本機，不升級成衝突視窗', () => {
    const merged = mergeBoardFiles(file({ order: 0 }), file({ order: 1 }), file({ order: 7 }));
    expect(merged).not.toBeNull();
    expect(parseBoard(merged!, 'x').order).toBe(1);
  });

  it('兩側封存旗標相反 → 採本機', () => {
    const merged = mergeBoardFiles(file({ archived: true }), file({}), file({ archived: true }));
    expect(parseBoard(merged!, 'x').archived).toBeUndefined();
  });

  it('名稱兩側改成不同值仍是真衝突（order 不會把它吃掉）', () => {
    expect(mergeBoardFiles(file({}), file({ name: 'A', order: 1 }), file({ name: 'B' }))).toBeNull();
  });
});

describe('keep-both 的白板複本', () => {
  it('複本一定不封存，否則救回來的那份會直接掉進封存區', () => {
    const path = boardPath('b1');
    const ours = file({ name: '本機', archived: true });
    const theirs = file({ name: '遠端', archived: true });
    const out = applyResolutions({ [path]: ours }, [{ path, choice: 'keep-both' }], { [path]: ours }, { [path]: theirs });
    const dupPath = Object.keys(out).find((p) => p !== path)!;
    const dup: Board = parseBoard(out[dupPath], 'x');
    expect(dup.archived).toBeUndefined();
    expect(dup.name).toBe('遠端 (衝突)');
  });
});
