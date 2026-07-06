import { test, expect, Page } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

// CONFIG
test.describe.configure({ mode: 'serial' });

const validUsername = process.env.TEST_USERNAME ?? 'demodev';
const validPassword = process.env.TEST_PASSWORD ?? 'uhi*d6ue';
const TARGET_FROM = 'KHI';
const TARGET_TO = 'DXB';
const DEPARTURE_DATE = '2026-08-23';

// ==========================================
// HELPERS
// ==========================================

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

async function login(page: Page, username: string, password: string): Promise<void> {
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
    .waitFor({ state: 'visible', timeout: 60_000 });
  console.log('Dashboard loaded');
}

async function handleUpdatePopup(page: Page): Promise<void> {
  try {
    const updateButton = page.locator('button.swal2-confirm:has-text("Update")');
    await updateButton.waitFor({ state: 'visible', timeout: 10_000 });
    console.log('Update popup appeared');
    await updateButton.click();
    console.log('Clicked update');
    
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.flightsearch');
        return el != null && el.getBoundingClientRect().top > 0;
      },
      { timeout: 120_000 }
    );
    
    await expect(page.locator('.flightbox').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(5_000);
    console.log('Portal fully reloaded after update');
  } catch {
    console.log('No update popup — continuing');
  }
}

async function selectAirport(page: Page, selector: string, airportCode: string): Promise<void> {
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible', timeout: 30_000 });
  await input.click();
  await input.fill(''); 
  
  // Brief pause so the field fully clears before typing
  await page.waitForTimeout(300);
  await input.type(airportCode, { delay: 200 });
  console.log(`Typing airport: ${airportCode}`);

  const listboxId = await input.getAttribute('aria-controls');
  if (!listboxId) {
    throw new Error(`Dropdown aria-controls not found for input "${selector}"`);
  }

  const dropdown = page.locator(`[id="${listboxId}"]`);
  await dropdown.waitFor({ state: 'visible', timeout: 30_000 });

  const option = dropdown
    .locator('[role="option"], li.k-list-item, .k-list-item')
    .filter({ hasText: airportCode })
    .first();
    
  await option.waitFor({ state: 'visible', timeout: 30_000 });
  await option.click();
  console.log(`${airportCode} selected`);
}

async function selectDepartureDate(page: Page): Promise<void> {
  const visibleCalendar = page.locator('.k-calendar:visible').first();
  await visibleCalendar.waitFor({ state: 'visible', timeout: 30_000 });

  const specificDay = visibleCalendar.locator(
    `td.k-calendar-td[data-value="${DEPARTURE_DATE}"]:not(.k-disabled) span.k-link`
  );
  const fallbackDay = visibleCalendar
    .locator('td.k-calendar-td:not(.k-disabled):not(.k-other-month) span.k-link')
    .first();

  const targetDay = (await specificDay.count()) > 0 ? specificDay : fallbackDay;
  await targetDay.click();

  // Wait for calendar popup to close
  await expect(visibleCalendar).toBeHidden({ timeout: 10_000 }).catch(() => {});
  console.log(`Departure date selected (target: ${DEPARTURE_DATE})`);
}

async function clickSearch(page: Page): Promise<void> {
  // Close Telerik calendar/dropdowns by clicking body
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(1_000);

  const searchButton = page.getByRole('button', { name: /^Search$/ });
  await expect(searchButton).toBeVisible({ timeout: 30_000 });
  await expect(searchButton).toBeEnabled({ timeout: 30_000 });
  await searchButton.click();
  console.log('Search button clicked');
}

async function expectLoginFailed(page: Page): Promise<void> {
  await page.waitForTimeout(4_000);
  await expect(page).not.toHaveURL(/dashboard/i);
  await expect(page.locator('[placeholder="Enter Login ID"]')).toBeVisible({ timeout: 15_000 });
  console.log('Login failed as expected');
}

async function loginAndReachDashboard(page: Page): Promise<void> {
  await openPortal(page);
  await login(page, validUsername, validPassword);
  await waitForDashboard(page);
  await handleUpdatePopup(page);
}

async function searchFlight(page: Page): Promise<void> {
  await page.locator('.flightbox').first().click();
  await selectAirport(page, '#from-autocomplete-0', TARGET_FROM);
  await selectAirport(page, '#to-autocomplete-0', TARGET_TO);
  await selectDepartureDate(page);
  await clickSearch(page);

  console.log("URL immediately:", page.url());
  await page.waitForTimeout(3000);
  console.log("URL after 3 sec:", page.url());
  await page.waitForTimeout(3000);
  console.log("URL after 6 sec:", page.url());
  await page.waitForLoadState('networkidle');
  console.log("Final URL:", page.url());

  const airlineFilter = page.locator('#dd-airline-filter');
  await expect(airlineFilter).toBeVisible({ timeout: 60_000 });
}

async function clickBookNow(page: Page): Promise<void> {
  const selectFlight = page.getByRole('button', { name: /Select Flight/i }).first();
  await expect(selectFlight).toBeVisible({ timeout: 120_000 });
  await selectFlight.click();
  console.log("Clicked Select Flight");

  const bookNow = page.getByRole('button', { name: /Book Now/i }).first();
  await expect(bookNow).toBeVisible({ timeout: 30_000 });
  await bookNow.click();
  console.log("Clicked Book Now");

  await page.waitForURL('**/FlightBook', { timeout: 120_000 });
  await expect(page).toHaveURL(/FlightBook/i);
  console.log("Successfully reached FlightBook");
}

// ==========================================
// AUTHENTICATION TESTS
// ==========================================

test('Forgot Password sends reset link successfully', async ({ page }) => {
  await openPortal(page);
  await page.locator('a.fw-semibold.text-primary:has-text("Forgot Password?")').click();

  const loginIdField = page.locator('input[placeholder="Login ID"]');
  await loginIdField.waitFor({ state: 'visible', timeout: 15_000 });
  await loginIdField.fill(validUsername);
  await page.locator('button.btn.btn-primary.w-100:has-text("Reset Password")').click();

  const successPopup = page.locator('div.swal2-popup.swal2-icon-success');
  await successPopup.waitFor({ state: 'visible', timeout: 15_000 });
  await expect(page.locator('#swal2-title')).toHaveText('Password Reset');
  await expect(page.locator('#swal2-html-container')).toHaveText(
    'Password reset link has been sent to your email.'
  );

  await page.locator('button.swal2-confirm:has-text("Ok")').click();
  console.log('Forgot Password flow completed successfully');
});

test.describe('Authentication', () => {
  test('Login fails with wrong username and correct password', async ({ page }) => {
    await openPortal(page);
    await login(page, 'wronguser', validPassword);
    await expectLoginFailed(page);
  });

  test('Login fails with correct username and wrong password', async ({ page }) => {
    await openPortal(page);
    await login(page, validUsername, 'wrongpassword');
    await expectLoginFailed(page);
  });

  test('Login fails with empty credentials', async ({ page }) => {
    await openPortal(page);
    await page.click('button[type="submit"]');
    await expectLoginFailed(page);
  });

  test('Login succeeds with valid credentials', async ({ page }) => {
    await openPortal(page);
    await login(page, validUsername, validPassword);
    await waitForDashboard(page);
    await expect(page).toHaveURL(/dashboard/i);
    console.log('Valid login confirmed');
  });
});

// ==========================================
// DASHBOARD TESTS
// ==========================================

test.describe('Dashboard', () => {
  test('Core dashboard UI elements are visible after login', async ({ page }) => {
    await loginAndReachDashboard(page);
    await expect(page.locator('.flightsearch')).toBeVisible();
    await expect(page.locator('.flightbox').first()).toBeVisible();
    console.log('Dashboard UI validated');
  });
});

// ==========================================
// FLIGHT SEARCH TESTS
// ==========================================

test.describe('Flight Search', () => {
  test(`Search ${TARGET_FROM} → ${TARGET_TO} redirects to flight listing`, async ({ page }) => {
    await loginAndReachDashboard(page);
    await searchFlight(page);
    await expect(page.locator('#dd-airline-filter')).toBeVisible();
  });

  test('Airline filter is visible after search completes', async ({ page }) => {
    await loginAndReachDashboard(page);
    await searchFlight(page);
    const airlineFilter = page.locator('#dd-airline-filter');
    await expect(airlineFilter).toBeVisible({ timeout: 60_000 });
  });

  test('At least one flight card appears in results', async ({ page }) => {
    await loginAndReachDashboard(page);
    await searchFlight(page);
    const cards = page.locator('.border.rounded.d-flex.flex-column.flex-md-row.mb-1');
    await expect(cards.first()).toBeVisible({ timeout: 120_000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });
});

// ==========================================
// BOOKING FLOW TEST
// ==========================================

test.describe('Booking Flow', () => {
  test('Full flow: search → select flight → Book Now', async ({ page }) => {
    await test.step('Login and reach dashboard', async () => {
      await loginAndReachDashboard(page);
    });

    await test.step(`Search ${TARGET_FROM} → ${TARGET_TO}`, async () => {
      await searchFlight(page);
    });

    const cards = page.locator('.border.rounded.d-flex.flex-column.flex-md-row.mb-1');

    await test.step('Wait for flight cards to load', async () => {
      await expect(cards.first()).toBeVisible({ timeout: 120_000 });
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Flights available: ${count}`);
    });

    await test.step('Select first flight and Book Now', async () => {
      await expect(cards.first()).toBeVisible({ timeout: 120_000 });
      await clickBookNow(page);
    });
  });
});