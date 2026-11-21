import { expect, test, type Page } from '@playwright/test';
import type { OccurrencesResponse } from '../../cms/src/lib/occurrences/types';

/**
 * Homepage behaviour: tabs, calendar, dance filters and `?event=` links from
 * the map. Test data is discovered from the CMS, so the suite does not depend
 * on specific IDs.
 */

const API = (process.env.PAYLOAD_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');

const visiblePanels = (page: Page) =>
  page.$$eval('.tab-content[data-tab]', (panels) =>
    panels
      .filter((panel) => getComputedStyle(panel).display !== 'none')
      .map((panel) => (panel as HTMLElement).dataset.tab),
  );

const visibleEntryIds = (page: Page, tab: string) =>
  page.$$eval(`#content-${tab} [data-entry]`, (entries) =>
    entries.filter((e) => !(e as HTMLElement).hidden).map((e) => (e as HTMLElement).dataset.eventId),
  );

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

async function upcoming(days: number): Promise<OccurrencesResponse> {
  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);
  const response = await fetch(`${API}/occurrences?from=${isoDate(from)}&to=${isoDate(to)}&locale=de`);
  return (await response.json()) as OccurrencesResponse;
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('tabs switch panels, update the hash and follow hash changes', async ({ page }) => {
  await page.goto('/de');
  expect(await visiblePanels(page)).toEqual(['socials']);

  await page.click('#tab-events');
  await expect(page.locator('#content-events')).toHaveCSS('opacity', '1');
  expect(await visiblePanels(page)).toEqual(['events']);
  await expect(page.locator('#tab-events')).toHaveAttribute('aria-selected', 'true');
  expect(page.url()).toMatch(/#events$/);

  // Rapid switching ends on the last tab.
  await page.click('#tab-classes');
  await page.click('#tab-socials');
  await expect(page.locator('#content-socials')).toHaveCSS('opacity', '1');
  expect(await visiblePanels(page)).toEqual(['socials']);

  await page.evaluate(() => (window.location.hash = 'classes'));
  await expect(page.locator('#content-classes')).toHaveCSS('opacity', '1');
  expect(await visiblePanels(page)).toEqual(['classes']);
});

test('deep link opens the tab without animation', async ({ page }) => {
  await page.goto('/de#classes');
  expect(await visiblePanels(page)).toEqual(['classes']);
  await expect(page.locator('#tab-classes')).toHaveAttribute('aria-selected', 'true');
});

test('calendar shows the active tab type and closes back to the list', async ({ page }) => {
  await page.goto('/de');
  await page.click('[data-calendar-toggle]');
  await expect(page.locator('#calendar-view')).toBeVisible();
  expect(await visiblePanels(page)).toEqual([]);

  const data = JSON.parse((await page.locator('#calendar-data').textContent()) ?? '{}');
  const typeByTitle = new Map<string, string>(data.entries.map((e: any) => [e.title, e.type]));
  const pillTypes = async () =>
    new Set((await page.locator('.calendar-pill__title').allTextContents()).map((t) => typeByTitle.get(t)));

  expect([...(await pillTypes())].every((type) => type === 'social')).toBe(true);
  await page.click('#tab-classes');
  expect([...(await pillTypes())].every((type) => type === 'class')).toBe(true);

  const pill = page.locator('.calendar-pill').first();
  if (await pill.count()) {
    await pill.click();
    await expect(page.locator('[data-calendar-modal]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-calendar-modal]')).toBeHidden();
    await expect(pill).toBeFocused();
  }

  await page.click('[data-calendar-toggle]');
  await expect(page.locator('#calendar-view')).toBeHidden();
  expect(await visiblePanels(page)).toEqual(['classes']);
});

test('dance filters narrow list and calendar', async ({ page }) => {
  await page.goto('/de');
  await page.click('[data-filter-toggle]');
  const tag = page.locator('.filter-panel [data-filter]').first();
  const key = (await tag.getAttribute('data-filter'))!;
  await tag.click();
  await expect(tag).toHaveAttribute('aria-pressed', 'true');

  const entries = await page.$$eval('#content-socials [data-entry]:not([data-focus-only])', (els) =>
    els.map((e) => ({ tags: (e as HTMLElement).dataset.tags!.split(','), hidden: (e as HTMLElement).hidden })),
  );
  for (const entry of entries) expect(entry.hidden).toBe(!entry.tags.includes(key));

  await tag.click();
  expect(await page.locator('#content-socials [data-entry]:not([data-focus-only])[hidden]').count()).toBe(0);
});

test('?event= from the map focuses that event and can be reset', async ({ page }) => {
  const { occurrences, events } = await upcoming(30);
  const target = occurrences.find((o) => events[String(o.eventId)]?.type === 'event');
  test.skip(!target, 'no event-type occurrence in the next 30 days');
  const id = String(target!.eventId);

  await page.goto(`/de?event=${id}`);
  expect(await visiblePanels(page)).toEqual(['events']);
  const ids = await visibleEntryIds(page, 'events');
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every((entryId) => entryId === id)).toBe(true);

  await page.click('[data-event-focus-reset]');
  expect(page.url()).not.toContain('event=');
  expect(await page.locator('#content-events [data-entry]:not([data-focus-only])[hidden]').count()).toBe(0);
});

test('?event= beyond the socials horizon still lists that event', async ({ page }) => {
  const { occurrences, events } = await upcoming(90);
  const horizon = isoDate(new Date(Date.now() + 14 * 86_400_000));
  const first = new Map<string, string>();
  for (const o of occurrences) if (!first.has(String(o.eventId))) first.set(String(o.eventId), o.date);
  const id = [...first].find(([eventId, date]) => events[eventId].type === 'social' && date > horizon)?.[0];
  test.skip(!id, 'no social whose first date is beyond 14 days');

  await page.goto(`/de?event=${id}`);
  const ids = await visibleEntryIds(page, 'socials');
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every((entryId) => entryId === id)).toBe(true);

  await page.click('[data-event-focus-reset]');
  expect(await visibleEntryIds(page, 'socials')).not.toContain(id);
});

test('unknown ?event= shows a notice and filters nothing', async ({ page }) => {
  await page.goto('/de?event=999999999');
  await expect(page.getByText('keine anstehenden Termine')).toBeVisible();
  await expect(page.locator('[data-event-focus]')).toBeHidden();
  expect(await page.locator('#content-socials [data-entry]:not([data-focus-only])[hidden]').count()).toBe(0);
});

test('unknown locales return 404', async ({ request }) => {
  expect((await request.get('/fr')).status()).toBe(404);
  expect((await request.get('/xyz/map')).status()).toBe(404);
});
