import { test, expect } from '@playwright/test';

test.describe('Kylrix UI Interactivity & Hydration Verification', () => {
  test('Landing page hydrates and handles clicks without silent errors', async ({ page }) => {
    const pageErrors: string[] = [];

    page.on('pageerror', (err) => {
      console.log('💥 UNCAUGHT ERROR MESSAGE:', err.message);
      console.log('💥 UNCAUGHT ERROR STACK:', err.stack);
      pageErrors.push(`[PageError] ${err.message}\n${err.stack || ''}`);
    });

    await page.addInitScript(() => {
      window.addEventListener('error', (event) => {
        const err = event.error;
        console.error('*** REACT RAW ERROR ***', {
          message: err?.message,
          stack: err?.stack,
          componentStack: err?.componentStack,
          digest: err?.digest,
          cause: err?.cause,
        });
      });
    });

    page.on('console', (msg) => {
      console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    });

    page.on('response', (res) => {
      if (!res.ok()) {
        console.log(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    // Navigate to landing page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify key interactive buttons exist
    const ctaButton = page.locator('button:has-text("Get Started Free"), button:has-text("Open App")').first();
    await expect(ctaButton).toBeAttached({ timeout: 15_000 });

    console.log('[Test Log] CTA button text:', await ctaButton.innerText());
    console.log('[Test Log] CTA button visible:', await ctaButton.isVisible());

    // Click CTA button
    await ctaButton.click({ force: true });
    console.log('[Test Log] Successfully clicked CTA button!');

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

  test('Guest CTA opens authentication modal/drawer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const ctaButton = page.locator('button:has-text("Get Started Free"), button:has-text("Open App")').first();
    await ctaButton.click({ force: true });

    // Verify modal, drawer, or navigation triggered
    const drawerOrModal = page.locator('[role="dialog"], input[type="email"], button:has-text("Sign In"), button:has-text("Continue")').first();
    await expect(drawerOrModal).toBeVisible({ timeout: 10_000 });
    console.log('[Test Log] Auth drawer/modal opened successfully upon click!');
  });
});
