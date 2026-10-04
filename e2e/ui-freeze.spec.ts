import { test, expect } from '@playwright/test';

test.describe('Kylrix UI Interactivity & Hydration Verification', () => {
  test('Landing page hydrates and handles clicks without silent errors', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(`[PageError] ${err.message}\n${err.stack || ''}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ConsoleError] ${msg.text()}`);
      }
    });

    // Navigate to landing page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify key interactive buttons exist
    const ctaButton = page.locator('button:has-text("Get Started Free"), button:has-text("Open App")').first();
    await expect(ctaButton).toBeVisible({ timeout: 15_000 });

    // Click CTA button
    await ctaButton.click();

    // Verify page didn't throw uncaught hydration or runtime errors
    expect(pageErrors, `Page encountered uncaught runtime errors:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('App shell hydrates and buttons are interactive', async ({ page }) => {
    const pageErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(`[PageError] ${err.message}\n${err.stack || ''}`);
    });

    // Navigate to /app
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    // Verify body is not blocking pointer events
    const bodyPointerEvents = await page.evaluate(() => window.getComputedStyle(document.body).pointerEvents);
    expect(bodyPointerEvents).not.toBe('none');

    // Find visible buttons in app shell
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Click the first visible button
    let clickedAny = false;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        await btn.click({ timeout: 3_000 });
        clickedAny = true;
        break;
      }
    }

    expect(clickedAny, 'Expected at least one button to be clickable').toBe(true);
    expect(pageErrors, `App shell encountered uncaught runtime errors:\n${pageErrors.join('\n')}`).toEqual([]);
  });
});
