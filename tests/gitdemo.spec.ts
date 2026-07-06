import { test, expect, Page } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

// CONFIG

test.describe.configure({ mode: 'serial' });

const validUsername = process.env.TEST_USERNAME ?? 'demodev';
const validPassword = process.env.TEST_PASSWORD ?? 'uhi*d6ue';

// HELPERS

async function waitForPortalLoader(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  await page
    .locator('img[alt="Loading..."]')
    .waitFor({ state: 'hidden', timeout: 60_000 })
    .catch((e: Error) => {
      if (!e.message.includes('locator.waitFor')) throw e;
    });
}

async function openPortal(page: Page): Promise<void> {
  await page.goto('/');
  await waitForPortalLoader(page);
  console.log('Portal opened');
}

async function login(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  const loginId = page.locator('[placeholder="Enter Login ID"]');

  await loginId.waitFor({ state: 'visible', timeout: 30_000 });
  await loginId.fill(username);
  await page.fill('[placeholder="Enter Password"]', password);
  await page.click('button[type="submit"]');

  console.log('Login button clicked');
}

async function waitForDashboard(page: Page): Promise<void> {
  await page.waitForURL(/dashboard/i, { timeout: 60_000 });

  await waitForPortalLoader(page);

  await page
    .locator('.flightsearch')
    .waitFor({
      state: 'visible',
      timeout: 60_000,
    });

  console.log('Dashboard loaded');
}

async function expectLoginFailed(page: Page): Promise<void> {
  await page.waitForTimeout(4000);

  await expect(page).not.toHaveURL(/dashboard/i);

  await expect(
    page.locator('[placeholder="Enter Login ID"]')
  ).toBeVisible({
    timeout: 15000,
  });

  console.log('Login failed as expected');
}

// ---------------------------------------------------------------------
// AUTHENTICATION TESTS
// ---------------------------------------------------------------------

test.describe('Authentication', () => {

  test('Forgot Password sends reset link successfully', async ({ page }) => {

    await openPortal(page);

    await page
      .locator('a.fw-semibold.text-primary:has-text("Forgot Password?")')
      .click();

    const loginIdField = page.locator(
      'input[placeholder="Login ID"]'
    );

    await loginIdField.waitFor({
      state: 'visible',
      timeout: 15000,
    });

    await loginIdField.fill(validUsername);

    await page
      .locator(
        'button.btn.btn-primary.w-100:has-text("Reset Password")'
      )
      .click();

    const successPopup = page.locator(
      'div.swal2-popup.swal2-icon-success'
    );

    await successPopup.waitFor({
      state: 'visible',
      timeout: 15000,
    });

    await expect(
      page.locator('#swal2-title')
    ).toHaveText('Password Reset');

    await expect(
      page.locator('#swal2-html-container')
    ).toHaveText(
      'Password reset link has been sent to your email.'
    );

    await page
      .locator('button.swal2-confirm:has-text("Ok")')
      .click();

    console.log('Forgot Password flow completed successfully');
  });

  test('Login fails with wrong username and correct password', async ({ page }) => {

    await openPortal(page);

    await login(
      page,
      'wronguser',
      validPassword
    );

    await expectLoginFailed(page);
  });

  test('Login fails with correct username and wrong password', async ({ page }) => {

    await openPortal(page);

    await login(
      page,
      validUsername,
      'wrongpassword'
    );

    await expectLoginFailed(page);
  });

  test('Login fails with empty credentials', async ({ page }) => {

    await openPortal(page);

    await page.click('button[type="submit"]');

    await expectLoginFailed(page);
  });

  test('Login succeeds with valid credentials', async ({ page }) => {

    await openPortal(page);

    await login(
      page,
      validUsername,
      validPassword
    );

    await waitForDashboard(page);

    await expect(page).toHaveURL(/dashboard/i);

    console.log('Valid login confirmed');
  });
});