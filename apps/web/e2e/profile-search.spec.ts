import { expect, test } from '@playwright/test';

test('searches by keyword, skill, and title through URL state', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '4 profiles' })).toBeVisible();

  const keyword = page.getByLabel('Search profiles');
  await keyword.fill('engineer');
  await expect(page).toHaveURL(/q=engineer/);

  const filters = page.locator('.filter-rail');
  const skill = filters.getByLabel('Skills');
  await skill.fill('type');
  await filters.getByRole('option', { name: /typescript/i }).click();

  const title = filters.getByLabel('Job title');
  await title.fill('senior engineer');
  await title.blur();

  await expect(page).toHaveURL(/skills=typescript/);
  await expect(page).toHaveURL(/title=senior(?:\+|%20)engineer/);
  await expect(page.getByText('Nika Rahimi')).toBeVisible();

  await filters.getByRole('button', { name: /clear 2/i }).click();
  await expect(page.getByRole('heading', { name: '4 profiles' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('keeps mobile controls usable with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '4 profiles' })).toBeVisible();
  await expect(page.locator('.filter-rail')).toBeHidden();

  const mobileFilters = page.locator('.mobile-filters > summary');
  await expect(mobileFilters).toBeVisible();
  expect((await mobileFilters.boundingBox())?.height).toBeGreaterThanOrEqual(
    44,
  );
  await mobileFilters.click();
  await expect(page.locator('#mobile-title')).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.profile-card')
      .first()
      .evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(',')
          .every((duration) => Number.parseFloat(duration) <= 0.00001),
      ),
  ).toBe(true);
});
