import { expect, test } from '@playwright/test';

// 冒煙測試：四視圖都能載入、切換，全程零 console error。
test('四視圖切換零 console 錯誤', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');

  // 白板（預設視圖）
  await expect(page.getByText('白板', { exact: true }).first()).toBeVisible();

  // 卡片庫
  await page.getByText('卡片庫', { exact: true }).first().click();
  await expect(page.getByPlaceholder('搜尋卡片、標籤、內容…')).toBeVisible();

  // 看板
  await page.getByText('看板', { exact: true }).first().click();
  await expect(page.getByText('新增專案').first()).toBeVisible();

  // 日記
  await page.getByText('日記', { exact: true }).first().click();
  await expect(page.getByText(/^今天 ·/)).toBeVisible();

  expect(errors, `console errors: ${errors.join('\n')}`).toEqual([]);
});
