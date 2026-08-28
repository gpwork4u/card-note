import { expect, test, type Page } from '@playwright/test';

/**
 * 白板分頁列的排序與封存。
 *
 * 種子資料有兩個白板：b1「產品白板」（預設所在）與 b2「技術 & 目標」。
 */

const tab = (page: Page, id: string) => page.locator(`[data-board-id="${id}"]`);

/** 分頁列目前的白板順序 */
async function tabOrder(page: Page): Promise<string[]> {
  return page.locator('[data-board-id]').evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.boardId ?? ''),
  );
}

async function centerOf(page: Page, id: string) {
  const box = await tab(page, id).boundingBox();
  if (!box) throw new Error(`找不到白板分頁 ${id}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(tab(page, 'b1')).toBeVisible();
});

test('拖曳分頁可以重新排序，且重載後保留', async ({ page }) => {
  expect(await tabOrder(page)).toEqual(['b1', 'b2']);

  const from = await centerOf(page, 'b2');
  const to = await centerOf(page, 'b1');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, from.y, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => tabOrder(page)).toEqual(['b2', 'b1']);

  // IndexedDB 鏡像有 400ms debounce，等它落地再重載
  await page.waitForTimeout(700);
  await page.reload();
  await expect(tab(page, 'b1')).toBeVisible();
  expect(await tabOrder(page)).toEqual(['b2', 'b1']);
});

test('拖曳不會誤觸切換白板', async ({ page }) => {
  // 目前所在是 b1；把 b2 拖到 b1 前面之後，仍應該停在 b1
  const from = await centerOf(page, 'b2');
  const to = await centerOf(page, 'b1');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => tabOrder(page)).toEqual(['b2', 'b1']);
  // 產品白板（b1）上的 c1 還在畫布上 → 沒有被切到 b2
  await expect(page.locator('[data-card-id="c1"]')).toBeVisible();
});

test('右鍵封存白板後分頁消失，可從管理白板還原', async ({ page }) => {
  await tab(page, 'b2').click({ button: 'right' });
  await page.getByText('封存白板', { exact: true }).click();

  await expect(tab(page, 'b2')).toHaveCount(0);
  await expect(page.getByText('已封存 1')).toBeVisible();

  await page.getByRole('button', { name: /管理白板/ }).click();
  await page.getByRole('button', { name: '取消封存 技術 & 目標' }).click();
  await page.getByRole('button', { name: '完成' }).click();

  await expect(tab(page, 'b2')).toBeVisible();
});

test('封存目前所在的白板會自動切到另一個白板', async ({ page }) => {
  await expect(page.locator('[data-card-id="c1"]')).toBeVisible(); // b1 的卡片

  await tab(page, 'b1').click({ button: 'right' });
  await page.getByText('封存白板', { exact: true }).click();

  await expect(tab(page, 'b1')).toHaveCount(0);
  // b2 的卡片 c6 出現 → 已經切過去了
  await expect(page.locator('[data-card-id="c6"]')).toBeVisible();
});
