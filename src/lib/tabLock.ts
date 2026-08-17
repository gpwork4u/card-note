/**
 * 多分頁互踩防護：同一時間只允許一個分頁真正執行 app。
 *
 * 多個分頁共用同一個 IndexedDB（appdata 鏡像 + sync baseline），但各自有
 * 記憶體 store。若兩個分頁都跑同步，B 分頁會用自己的舊狀態對 A 分頁剛
 * 更新過的 baseline 做三方合併，把 A 的編輯誤判成「本機刪改」而回退——
 * 互相蓋資料。因此用 Web Locks 選出唯一的作用中分頁；其餘分頁待命，
 * 等鎖釋放（作用中分頁關閉）後再走正常啟動流程接手。
 *
 * 不支援 Web Locks 的環境（極舊瀏覽器、部分測試環境）直接視為取得鎖，
 * 行為等同加入此防護之前。
 */

const LOCK_NAME = 'card-note-primary-tab';

export interface TabLockApi {
  request: LockManager['request'];
}

function locksApi(): TabLockApi | null {
  return typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null;
}

/** 鎖要一直握到分頁關閉：callback 回傳永不 resolve 的 promise。 */
function holdForever(): Promise<never> {
  return new Promise<never>(() => {});
}

let primaryAttempt: Promise<boolean> | null = null;
let becamePrimary: Promise<void> | null = null;

/** 嘗試立刻成為作用中分頁。已被其他分頁佔用時回傳 false（不等待）。
 *  結果會被快取，重複呼叫（如 StrictMode 雙掛載）拿到同一個 promise。 */
export function requestPrimaryTab(locks: TabLockApi | null = locksApi()): Promise<boolean> {
  if (!primaryAttempt) {
    primaryAttempt = !locks
      ? Promise.resolve(true)
      : new Promise((resolve) => {
          void locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
            if (!lock) {
              resolve(false);
              return undefined;
            }
            resolve(true);
            return holdForever();
          });
        });
  }
  return primaryAttempt;
}

/** 排隊等待成為作用中分頁；前一個分頁關閉、鎖釋放時 resolve。 */
export function waitForPrimaryTab(locks: TabLockApi | null = locksApi()): Promise<void> {
  if (!becamePrimary) {
    becamePrimary = !locks
      ? Promise.resolve()
      : new Promise((resolve) => {
          void locks.request(LOCK_NAME, () => {
            resolve();
            return holdForever();
          });
        });
  }
  return becamePrimary;
}

/** 僅供測試：清掉模組層快取。 */
export function resetTabLockForTests() {
  primaryAttempt = null;
  becamePrimary = null;
}
