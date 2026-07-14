import { test, expect } from '@playwright/test';

/**
 * Confirms the frontend actually renders after the Next.js upgrade and the
 * LoginScreen change — i.e. the build boots and the core public pages paint.
 */

test('landing page renders the GameOn brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/GameOn/i);
});

test('privacy policy page renders its heading', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
});

test('data processing agreement page renders', async ({ page }) => {
  await page.goto('/dpa');
  await expect(page.getByRole('heading', { name: /data processing agreement/i })).toBeVisible();
});

test('play page shows the join form', async ({ page }) => {
  await page.goto('/play');
  // The login screen asks for a game key first; assert an input is present.
  await expect(page.locator('input').first()).toBeVisible();
});

test('pricing monthly/annual toggle switches price and checkout link', async ({ page }) => {
  await page.goto('/');
  const proCta = page.locator('a[data-cta][data-plan="pro"]');

  // Defaults to monthly.
  await expect(page.locator('.pricing-card-highlight [data-price]')).toHaveText('199');
  await expect(proCta).toHaveAttribute('href', '/play?plan=pro&interval=monthly');

  // Switch to annual.
  await page.getByRole('button', { name: /Annual/ }).click();
  await expect(page.locator('.pricing-card-highlight [data-price]')).toHaveText('1 490');
  await expect(proCta).toHaveAttribute('href', '/play?plan=pro&interval=yearly');
});
