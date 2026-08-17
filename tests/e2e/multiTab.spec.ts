import { expect, test } from '@playwright/test';

// 多分頁互踩防護：同時只有一個分頁真正執行，第二個待命；主分頁關閉後自動接手。
test('第二個分頁待命，主分頁關閉後接手', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/');
  await expect(first.getByText('白板', { exact: true }).first()).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText('已在另一個分頁開啟')).toBeVisible();

  await first.close();
  await expect(second.getByText('白板', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
});
