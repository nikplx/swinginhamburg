import { expect, test } from '@playwright/test';

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('survey teaser collapse is remembered', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/de');
  const box = page.locator('.survey-box');
  test.skip(!(await box.count()), 'survey text is empty in the CMS');

  await page.click('.survey-collapse');
  await expect(box).toHaveClass(/is-collapsed/);
  await page.reload();
  await expect(box).toHaveClass(/is-collapsed/);
  await page.click('.survey-expand');
  await expect(box).not.toHaveClass(/is-collapsed/);
});

test('organization anchors open their item; the list is exclusive', async ({ page }) => {
  await page.goto('/de/organizations');
  const items = page.locator('.responsive-item');
  test.skip((await items.count()) < 2, 'needs at least two organizations');
  const [first, second] = [
    await items.nth(0).getAttribute('id'),
    await items.nth(1).getAttribute('id'),
  ];

  await page.goto(`/de/organizations#${first}`);
  await expect(page.locator(`#${first}`)).toHaveClass(/open/);
  await page.click(`#${second} .responsive-item-header`);
  await expect(page.locator(`#${second}`)).toHaveClass(/open/);
  await expect(page.locator(`#${first}`)).not.toHaveClass(/open/);
});

test('mobile menu toggles aria-expanded and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/de');
  const toggle = page.locator('.menu-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});
