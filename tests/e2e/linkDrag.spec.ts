import { expect, test, type Page } from '@playwright/test';

/**
 * 白板拖曳建立連結：從卡片右緣的圓點拖到另一張卡片。
 *
 * 種子白板「產品白板」上有 c1 c2 c3 c4 c5 c8，其中 c1–c2 已經是實線連結、
 * c1–c3 沒有連結。測試刻意挑這兩組來分別驗證「新建」與「不重複建立」。
 */

const LINKED = { from: 'c1', to: 'c2' }; // 已存在
const UNLINKED = { from: 'c1', to: 'c3' }; // 尚未連結

/** 連結在 DOM 上的正規 key，與 lib/derive 的 linkKey 一致（順序無關） */
const key = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`);

const linkPath = (page: Page, a: string, b: string) => page.locator(`path[data-link="${key(a, b)}"]`);

async function centerOf(page: Page, cardId: string) {
  const box = await page.locator(`[data-card-id="${cardId}"]`).boundingBox();
  if (!box) throw new Error(`找不到卡片 ${cardId}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 卡片左上角＝它在白板上的位置。判斷「有沒有被移動」要看這個，不能看中心點：
 *  連結數徽章由 2 變 3 時，卡片高度會有 1-2px 的重繪抖動，中心點會跟著飄。 */
async function originOf(page: Page, cardId: string) {
  const box = await page.locator(`[data-card-id="${cardId}"]`).boundingBox();
  if (!box) throw new Error(`找不到卡片 ${cardId}`);
  return { x: box.x, y: box.y };
}

async function handleOf(page: Page, cardId: string) {
  const box = await page.locator(`[data-link-handle="${cardId}"]`).boundingBox();
  if (!box) throw new Error(`卡片 ${cardId} 沒有連結圓點`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 從 from 卡的圓點拖到 to 卡中心；to 給 null 則拖到空白處放開 */
async function dragLink(page: Page, from: string, to: string | null) {
  const start = await handleOf(page, from);
  const end = to ? await centerOf(page, to) : { x: start.x + 30, y: start.y + 250 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 5 });
  return {
    drop: () => page.mouse.up(),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(`[data-card-id="${UNLINKED.from}"]`)).toBeVisible();
});

test('拖到另一張卡片會建立連結', async ({ page }) => {
  await expect(linkPath(page, UNLINKED.from, UNLINKED.to)).toHaveCount(0);

  const drag = await dragLink(page, UNLINKED.from, UNLINKED.to);
  await drag.drop();

  await expect(linkPath(page, UNLINKED.from, UNLINKED.to)).toHaveCount(1);
  await expect(linkPath(page, UNLINKED.from, UNLINKED.to)).toHaveAttribute('data-link-type', 'solid');
});

test('拖曳中顯示預覽線，放開在空白處不建立連結', async ({ page }) => {
  const before = await page.locator('path[data-link]').count();

  const drag = await dragLink(page, UNLINKED.from, null);
  // 預覽線是唯一一條沒有 data-link 的虛線 path
  await expect(page.locator('svg path[stroke-dasharray="5 5"]:not([data-link])')).toHaveCount(1);

  await drag.drop();
  await expect(page.locator('svg path[stroke-dasharray="5 5"]:not([data-link])')).toHaveCount(0);
  await expect(page.locator('path[data-link]')).toHaveCount(before);
});

test('對已連結的兩張卡再拖一次不會產生第二條', async ({ page }) => {
  await expect(linkPath(page, LINKED.from, LINKED.to)).toHaveCount(1);
  const before = await page.locator('path[data-link]').count();

  const drag = await dragLink(page, LINKED.from, LINKED.to);
  await drag.drop();

  await expect(linkPath(page, LINKED.from, LINKED.to)).toHaveCount(1);
  await expect(page.locator('path[data-link]')).toHaveCount(before);
});

test('拖圓點不會順便移動來源卡片，也不會開啟卡片詳情', async ({ page }) => {
  const before = await originOf(page, UNLINKED.from);

  const drag = await dragLink(page, UNLINKED.from, UNLINKED.to);
  await drag.drop();

  const after = await originOf(page, UNLINKED.from);
  expect(after).toEqual(before);
  // 詳情面板沒被打開（面板內才有標籤輸入框）
  await expect(page.getByPlaceholder('新增標籤…')).toHaveCount(0);
});

test('AI 建議的虛線連結，拖一次會升級成實線', async ({ page }) => {
  // 種子資料裡 c3–c5 是 AI 建議連結
  await expect(linkPath(page, 'c3', 'c5')).toHaveAttribute('data-link-type', 'ai');

  const drag = await dragLink(page, 'c3', 'c5');
  await drag.drop();

  await expect(linkPath(page, 'c3', 'c5')).toHaveAttribute('data-link-type', 'solid');
});
