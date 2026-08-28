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

  it('超出安全整數範圍的 order 一律忽略', () => {
    // JSON.parse 會把 9007199254740993 靜默變成 ...992，再序列化就等於改寫了
    // 一個使用者沒動過的白板檔；iOS 的 64-bit Int 又不會用同樣方式截斷。
    const b = parseBoard('{"id":"b1","name":"n","order":9007199254740993,"placements":[]}', 'fb');
    expect(b.order).toBeUndefined();
    expect(serializeBoard({ ...base, order: Number.MAX_SAFE_INTEGER + 2 })).not.toContain('order');
  });

  it('MAX_SAFE_INTEGER 本身仍是合法的 order', () => {
    const text = file({ order: Number.MAX_SAFE_INTEGER });
    expect(parseBoard(text, 'fb').order).toBe(Number.MAX_SAFE_INTEGER);
    expect(serializeBoard(parseBoard(text, 'fb'))).toBe(text);
  });

  it('無法寫成安全整數的座標退成 0（否則 iOS 會在 Int 轉換時 trap）', () => {
    const b = parseBoard('{"id":"b1","name":"n","placements":[{"cardId":"c1","x":1e100,"y":5}]}', 'fb');
    expect(b.placements[0]).toEqual({ cardId: 'c1', x: 0, y: 5 });
    expect(serializeBoard({ ...base, placements: [{ cardId: 'c1', x: Infinity, y: 5 }] })).toContain('"x": 0');
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

describe('兩台裝置各自排序後會收斂', () => {
  // 「兩側都改採本機」看起來像會無限乒乓，但推送有 CAS：只有一端能先寫進去，
  // 另一端合併後推送第二版，第一端下次同步時本機已等於 base，於是採遠端。
  it('第二輪同步後兩端得到同一份 order', () => {
    const old = file({ order: 0 });
    const d1 = file({ order: 1 }); // 裝置一排序後先推上去
    const d2 = file({ order: 2 }); // 裝置二在舊 base 上各自排序

    // 裝置二拉到 d1，合併後推第二版
    const round1 = mergeBoardFiles(old, d2, d1)!;
    expect(parseBoard(round1, 'x').order).toBe(2);

    // 裝置一再同步：本機還是 d1（沒再動過）＝ base，於是採遠端
    const round2 = mergeBoardFiles(d1, d1, round1)!;
    expect(parseBoard(round2, 'x').order).toBe(2);
    expect(round2).toBe(round1);
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
