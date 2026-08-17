import { beforeEach, describe, expect, it } from 'vitest';
import { requestPrimaryTab, resetTabLockForTests, waitForPrimaryTab, type TabLockApi } from '@/lib/tabLock';

/** 極簡 Web Locks 模擬：單一具名鎖，排他、先到先得、其餘排隊。 */
function makeLocks() {
  let held = false;
  const queue: Array<() => void> = [];

  const release = () => {
    held = false;
    const next = queue.shift();
    if (next) next();
  };

  const api: TabLockApi = ((name: string, optionsOrCb: unknown, maybeCb?: unknown) => {
    const options = (typeof optionsOrCb === 'function' ? {} : optionsOrCb) as { ifAvailable?: boolean };
    const cb = (typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb) as (
      lock: unknown,
    ) => Promise<unknown> | undefined;

    if (held && options.ifAvailable) return Promise.resolve(cb(null));

    const grant = () => {
      held = true;
      return cb({ name });
    };
    if (!held) return Promise.resolve(grant());
    return new Promise((resolve) => queue.push(() => resolve(grant())));
  }) as unknown as TabLockApi;

  return { api: { request: api } as unknown as TabLockApi, release, isHeld: () => held };
}

describe('tabLock', () => {
  beforeEach(() => resetTabLockForTests());

  it('第一個分頁取得鎖並持續持有', async () => {
    const locks = makeLocks();
    await expect(requestPrimaryTab(locks.api)).resolves.toBe(true);
    expect(locks.isHeld()).toBe(true);
  });

  it('鎖已被佔用時第二個分頁立刻拿到 false，不會卡住', async () => {
    const locks = makeLocks();
    await requestPrimaryTab(locks.api); // 分頁 A（同一個模擬 LockManager 代表同一 origin）
    resetTabLockForTests(); // 模擬另一個分頁的模組實例
    await expect(requestPrimaryTab(locks.api)).resolves.toBe(false);
  });

  it('前一個分頁釋放後，排隊的分頁才接手', async () => {
    const locks = makeLocks();
    await requestPrimaryTab(locks.api);
    resetTabLockForTests();

    let promoted = false;
    void waitForPrimaryTab(locks.api).then(() => {
      promoted = true;
    });
    await Promise.resolve();
    expect(promoted).toBe(false);

    locks.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(promoted).toBe(true);
    expect(locks.isHeld()).toBe(true);
  });

  it('環境不支援 Web Locks 時視為取得鎖', async () => {
    await expect(requestPrimaryTab(null)).resolves.toBe(true);
    resetTabLockForTests();
    await expect(waitForPrimaryTab(null)).resolves.toBeUndefined();
  });

  it('重複呼叫共用同一個請求（StrictMode 雙掛載不會搶兩次）', async () => {
    const locks = makeLocks();
    const a = requestPrimaryTab(locks.api);
    const b = requestPrimaryTab(locks.api);
    expect(a).toBe(b);
    await expect(b).resolves.toBe(true);
  });
});
