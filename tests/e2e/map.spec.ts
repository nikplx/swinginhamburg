import { expect, test } from '@playwright/test';

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('markers open popups that link to the homepage', async ({ page }) => {
  await page.goto('/de/map');
  const marker = page.locator('.sih-map-marker').first();
  await expect(marker).toBeVisible();
  // Markers can overlap; any of them opens a popup.
  await marker.click({ force: true });
  const link = page.locator('.custom-popup-content a').first();
  await expect(link).toHaveAttribute('href', /^\/de\/\?event=\d+$/);
});

test('day filter hides markers without events that day', async ({ page }) => {
  await page.goto('/de/map');
  await expect(page.locator('.sih-map-marker').first()).toBeVisible();
  const all = await page.locator('.sih-map-marker').count();

  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
    await page.click(`.filter-btn[data-day="${day}"]`);
    await expect(page.locator(`.filter-btn[data-day="${day}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.sih-map-marker').count()).toBeLessThanOrEqual(all);
  }
  await page.click('.filter-btn[data-day="all"]');
  expect(await page.locator('.sih-map-marker').count()).toBe(all);
});

test('mobile drawer toggles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/de/map');
  const toggle = page.locator('.mobile-filter-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.click('.close-filter-btn');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
