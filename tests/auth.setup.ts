import { test, expect, Page } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

// CONFIG

test.describe.configure({ mode: 'serial' });

const validUsername = process.env.TEST_USERNAME ?? 'demodev';
const validPassword = process.env.TEST_PASSWORD ?? 'uhi*d6ue';

const TARGET_FROM = 'KHI';
const TARGET_TO   = 'DXB';

const DEPARTURE_DATE = '2026-08-23';

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

async function openFlightsPage(
  page: Page,
  menuHref: string,
  expectedUrl: RegExp
): Promise<void> {

  await loginAndReachDashboard(page);

  const flightsMenu = page.locator(
    'a.nav-link.dropdown-toggle:has-text("Flights")'
  );

  await flightsMenu.hover();

  const menuItem = page.locator(
    `a.dropdown-item[href="${menuHref}"]`
  );

  await expect(menuItem).toBeVisible({
    timeout: 10000
  });

 await Promise.all([
    page.waitForURL(expectedUrl),
    menuItem.click()
]);
await waitForPortalLoader(page);
}

async function openHotelPage(
  page: Page,
  menuHref: string,
  expectedUrl: RegExp
): Promise<void> {

  await loginAndReachDashboard(page);

  const hotelsMenu = page.locator(
    'a.nav-link.dropdown-toggle:has-text("Hotels")'
  );

  await hotelsMenu.hover();

  await page.waitForSelector(
      'li.nav-item.dropdown.show'
  );

  const menuItem = page.locator(
    `a.dropdown-item[href="${menuHref}"]`
  );

  await expect(menuItem).toBeVisible({
    timeout: 10000,
  });

  await Promise.all([
    page.waitForURL(expectedUrl),
    menuItem.click(),
  ]);

  await waitForPortalLoader(page);
}

async function expectHotelSearchPage(page: Page): Promise<void> {

  await expect(
    page.locator('.flightsearch')
  ).toBeVisible({ timeout: 600000 });

  await expect(
    page.getByText('Destination, Hotel, Location')
  ).toBeVisible();

  await expect(
    page.getByText('Check In Date')
  ).toBeVisible();

  await expect(
    page.getByText('Check Out Date')
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: /^Search$/ })
  ).toBeVisible();

  console.log('Hotel Search page opened successfully');
}

async function clickHotelSearch(page: Page): Promise<void> {

  const searchButton = page.getByRole('button', {
    name: /^Search$/
  });

  await expect(searchButton).toBeVisible({
    timeout: 30000
  });

  await expect(searchButton).toBeEnabled();

  await searchButton.click();

  await waitForPortalLoader(page);

  console.log('Hotel Search clicked');
}

async function selectHotelLocation(
  page: Page,
  location: string
): Promise<void> {

  // Open the location popup
  await page
    .locator('.flightbox')
    .first()
    .locator('.bg-primary-100')
    .click();

  const input = page.locator('#HotelAutoComplete');

  await input.waitFor({
    state: 'visible',
    timeout: 30000,
  });

  await input.fill('');

  await input.type(location, {
    delay: 150,
  });

  const listboxId = await input.getAttribute('aria-controls');

  if (!listboxId)
    throw new Error('Hotel dropdown not found.');

  const dropdown = page.locator(`#${listboxId}`);

  await dropdown.waitFor({
    state: 'visible',
    timeout: 30000,
  });

  await dropdown
    .locator('[role="option"]')
    .filter({
      hasText: location,
    })
    .first()
    .click();

  console.log(`${location} selected`);
}

async function selectAirport(
  page: Page,
  selector: string,
  airportCode: string
): Promise<void> {
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

const HOTEL_CHECKIN = '2026-07-01';
const HOTEL_CHECKOUT = '2026-07-02';

async function selectHotelDates(page: Page) {

  await page
    .getByText('Check In Date')
    .click();

  const calendar = page.locator('.k-calendar:visible').first();

  await calendar.waitFor();

  await calendar
    .locator(
      `td[data-value="${HOTEL_CHECKIN}"] span.k-link`
    )
    .click();

  await calendar
    .locator(
      `td[data-value="${HOTEL_CHECKOUT}"] span.k-link`
    )
    .click();

  console.log('Hotel dates selected');
}

async function selectDepartureDate(page: Page): Promise<void> {
  const visibleCalendar = page
    .locator('.k-calendar:visible')
    .first();

  await visibleCalendar.waitFor({
    state: 'visible',
    timeout: 30_000
  });

  const specificDay = visibleCalendar.locator(
    `td.k-calendar-td[data-value="${DEPARTURE_DATE}"]:not(.k-disabled) span.k-link`
  );

  const fallbackDay = visibleCalendar
    .locator(
      'td.k-calendar-td:not(.k-disabled):not(.k-other-month) span.k-link'
    )
    .first();

  const targetDay =
    (await specificDay.count()) > 0
      ? specificDay
      : fallbackDay;

  await targetDay.click();

  // Wait for calendar popup to close
  await expect(visibleCalendar).toBeHidden({
    timeout: 10_000
  }).catch(() => {});

  console.log(`Departure date selected (target: ${DEPARTURE_DATE})`);
}

async function clickSearch(page: Page): Promise<void> {
  // Close Telerik calendar/dropdowns by clicking body
  await page.locator('body').click({ position: { x: 10, y: 10 } });

  // Wait for overlays to disappear
  await page.waitForTimeout(1_000);

  const searchButton = page.getByRole('button', { name: /^Search$/ });

  await expect(searchButton).toBeVisible({ timeout: 30_000 });
  await expect(searchButton).toBeEnabled({ timeout: 30_000 });

  // Trial click first to ensure no interception
  await searchButton.click({ trial: true });

  // Real click
  await searchButton.click();

  console.log('Search button clicked');
}

async function expectLoginFailed(page: Page): Promise<void> {
  await page.waitForTimeout(4_000);

  await expect(page).not.toHaveURL(/dashboard/i);
  await expect(
    page.locator('[placeholder="Enter Login ID"]')
  ).toBeVisible({ timeout: 15_000 });

  console.log('Login failed as expected');
}

/**
 * Shared setup: open portal → log in → wait for dashboard → handle popup.
 */
async function loginAndReachDashboard(page: Page): Promise<void> {
  await openPortal(page);
  await login(page, validUsername, validPassword);
  await waitForDashboard(page);
  await handleUpdatePopup(page);
}

/**
 * Navigates to FlightListing and waits for the airline filter to confirm
 * the page has fully rendered. Uses toHaveURL with a timeout AFTER the
 * waitForURL call inside this helper so the assertion sees a stable URL.
 */
async function searchFlight(page: Page): Promise<void> {
  await page.locator('.flightbox').first().click();

  await selectAirport(page, '#from-autocomplete-0', TARGET_FROM);
  await selectAirport(page, '#to-autocomplete-0', TARGET_TO);

  await selectDepartureDate(page);

  await clickSearch(page);

  // Wait for Blazor SPA navigation to commit the new URL
  await page.waitForURL('**/FlightListing', {
    waitUntil: 'commit',
    timeout: 120_000,
  });

  // FIX: wait for full page render before any further assertions.
  // This is the single source of truth that FlightListing has loaded —
  // calling toHaveURL right after waitForURL on a Blazor SPA is fragile
  // because the URL can still be in transition. All tests that need to
  // confirm the URL do so AFTER this waitFor resolves.
  await page.locator('#dd-airline-filter').waitFor({
    state: 'visible',
    timeout: 60_000,
  });

  console.log('FlightListing page confirmed');
}

/**
 * Clicks "Book Now" directly — the button is already present inside the
 * flight tab without needing a fare card selection first.
 * Falls back to opening the fare carousel if the button is not yet visible.
 */
async function clickBookNow(page: Page): Promise<void> {
  const bookNowBtn = page
    .getByRole('button', { name: /Book Now/i })
    .first();

  // Check if Book Now is already visible without expanding anything
  const alreadyVisible = await bookNowBtn.isVisible().catch(() => false);

  if (!alreadyVisible) {
    // Open the fare carousel — Blazor pre-selects the first fare,
    // which makes "Book Now" appear without a manual card click.
    const selectFlightBtn = page
      .locator('button.btn.btn-primary', { hasText: /^Select Flight$/ })
      .first();

    await expect(selectFlightBtn).toBeVisible({ timeout: 120_000 });
    await selectFlightBtn.click();
    console.log('Opened fare carousel');
  }

  await expect(bookNowBtn).toBeVisible({ timeout: 30_000 });
  await bookNowBtn.click();
  console.log('Book Now clicked');
}

// OPERATIONS -> ACCOUNTS TESTS

async function openAccountsPage(
  page: Page,
  menuHref: string,
  expectedUrl: RegExp
): Promise<void> {

  await loginAndReachDashboard(page);

  // Hover Operations menu
  const operationsMenu = page.locator(
    'a.nav-link.dropdown-toggle:has-text("Operations")'
  );

  await expect(operationsMenu).toBeVisible({ timeout: 30000 });
  await operationsMenu.click();

  await expect(operationsMenu).toHaveAttribute(
    'aria-expanded',
    'true',
    { timeout: 500000 }
  );

  // Wait for Operations dropdown to appear
  const operationsDropdown = page.locator(
    'ul.dropdown-menu'
  ).first();

  await expect(operationsDropdown).toBeVisible({
    timeout: 10000,
  });

  // Hover the Accounts menu item (anchor, not span)
  const accountsMenu = page.locator(
    'li.dropdown-submenu > a.dropdown-item'
  );

  await expect(accountsMenu).toBeVisible({
    timeout: 10000,
  });

  await accountsMenu.hover();

  // Wait for submenu item to appear
  const menuItem = page.locator(
    `a.dropdown-item[href="${menuHref}"]`
  );

  await expect(menuItem).toBeVisible({
    timeout: 10000,
  });

  await Promise.all([
    page.waitForURL(expectedUrl),
    menuItem.click(),
  ]);

  await waitForPortalLoader(page);
}

// AUTHENTICATION TESTS

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

// ----------------------------------------------------------------

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

// DASHBOARD TESTS

test.describe('Dashboard', () => {
  test('Core dashboard UI elements are visible after login', async ({ page }) => {
    await loginAndReachDashboard(page);

    await expect(page.locator('.flightsearch')).toBeVisible();
    await expect(page.locator('.flightbox').first()).toBeVisible();

    console.log('Dashboard UI validated');
  });
});


// IMPORT PNR TESTS

// test.describe('Import PNR', () => {

//   test('User can open Import PNR page', async ({ page }) => {
//         await openFlightsPage(
//         page,
//         "/ImportPNR",
//         /ImportPNR/i
//     );
//     await expect(
//       page.locator('input[placeholder="PNR"]')
//     ).toBeVisible();
//   });

//   test('Supplier dropdown opens when clicking anywhere on the field', async ({ page }) => {

//     await openFlightsPage(
//         page,
//         "/ImportPNR",
//         /ImportPNR/i
//     );

//     const supplierInput = page.locator(
//         'input[placeholder="Select Supplier"]'
//     );

//     await supplierInput.click();

//     const listId =
//         await supplierInput.getAttribute('aria-controls');

//     await expect(
//         page.locator(`#${listId}`)
//     ).toBeVisible();

// });

// ----------------------------------------------------------------
// CLI / TERMINAL TESTS
// ----------------------------------------------------------------

test.describe('CLI / Terminal', () => {

  test('User can open Galileo CLI page', async ({ page }) => {

    await openFlightsPage(
      page,
      "/GalileoCLI",
      /GalileoCLI/i
    );

    const terminal = page.locator(
      'div[style*="background-color:black"]'
    );

    await expect(terminal).toBeVisible();

    await expect(terminal).toContainText("CLI Disable");
  });

  test('User can open Sabre CLI page', async ({ page }) => {

    await openFlightsPage(
      page,
      "/SabreCLI",
      /SabreCLI/i
    );

    const terminal = page.locator(
      'div[style*="background-color:black"]'
    );

    await expect(terminal).toBeVisible();

    await expect(terminal).toContainText("Connected");
  });

});

test.describe('Operations - Accounts', () => {

  test('User can open Account TopUp page', async ({ page }) => {

    await openAccountsPage(
      page,
      '/AccountTopup',
      /AccountTopup/i
    );

    await expect(
      page.getByText('Payment Mode')
    ).toBeVisible();

    await expect(
      page.getByText('Amount')
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: 'Create Payment'
      })
    ).toBeVisible();

    console.log('Account TopUp page loaded successfully');
  });

  test('Payment Mode dropdown opens successfully', async ({ page }) => {

    await openAccountsPage(
      page,
      '/AccountTopup',
      /AccountTopup/i
    );

    const paymentMode = page.locator(
      'input[placeholder="Select Payment Mode"]'
    );

    await paymentMode.click();

    const listId = await paymentMode.getAttribute('aria-controls');

    expect(listId).not.toBeNull();

    await expect(
      page.locator(`#${listId}`)
    ).toBeVisible();

    console.log('Payment Mode dropdown opened successfully');
  });

  test('User can open Credit Limit Enhancement page', async ({ page }) => {

    await openAccountsPage(
      page,
      '/CreditLimitEnhancement',
      /CreditLimitEnhancement/i
    );

    await expect(
      page.locator('table')
    ).toBeVisible();

    await expect(
      page.getByRole('columnheader', {
        name: 'Amount'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('columnheader', {
        name: 'Period (Days)'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('columnheader', {
        name: 'Approved Amount'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('columnheader', {
        name: 'Approval Status'
      })
    ).toBeVisible();

    console.log('Credit Limit Enhancement table loaded successfully');
  });

});

//});

// HOTEL TESTS

test.describe('Hotels', () => {

  test('User can open Hotel Booking History page', async ({ page }) => {
    await loginAndReachDashboard(page);

    const hotelsMenu = page.locator(
      'a.nav-link.dropdown-toggle:has-text("Hotels")'
    );

    await hotelsMenu.hover();

    const bookingHistory = page.locator(
      'a.dropdown-item[href="/HotelBookingList"]'
    );

    await expect(bookingHistory).toBeVisible();

    await Promise.all([
      page.waitForURL(/HotelBookingList/i),
      bookingHistory.click(),
    ]);

    await waitForPortalLoader(page);

    // Grid should be visible
    await expect(
      page.locator('div.k-grid')
    ).toBeVisible({ timeout: 60000 });

    console.log('Hotel Booking History page opened successfully');
  });

  // test('User can open Hotel Search page', async ({ page }) => {
  //   await loginAndReachDashboard(page);

  //   const hotelsMenu = page.locator(
  //     'a.nav-link.dropdown-toggle:has-text("Hotels")'
  //   );

  //   await hotelsMenu.hover();

  //   const hotelSearch = page.locator(
  //     'a.dropdown-item[href="/Dashboard?Search=Hotel"]'
  //   );

  //   await expect(hotelSearch).toBeVisible();

  //   await Promise.all([
  //     page.waitForURL(/Search=Hotel/i),
  //     hotelSearch.click(),
  //   ]);

  //   await waitForPortalLoader(page);

  //   // Hotel search form should be displayed
  //   await expect(
  //     page.locator('.flightsearch')
  //   ).toBeVisible({ timeout: 60000 });

  //   await expectHotelSearchPage(page);

  //   console.log('Hotel Search page opened successfully');
  // });

});

test('User can search hotels', async ({ page }) => {

  await openHotelPage(
    page,
    '/Dashboard?Search=Hotel',
    /Search=Hotel/i
  );

  await expectHotelSearchPage(page);

  await selectHotelLocation(page, 'Islamabad');

  await selectHotelDates(page);

  await clickHotelSearch(page);

  // Wait for hotel results page (replace with your actual URL if different)
  await waitForPortalLoader(page);

  console.log('Hotel search completed');
});

// FLIGHT SEARCH TESTS

test.describe('Flight Search', () => {
  test(`Search ${TARGET_FROM} → ${TARGET_TO} redirects to flight listing`, async ({ page }) => {
    await loginAndReachDashboard(page);
    await searchFlight(page);

    // searchFlight() already waits for #dd-airline-filter which only exists
    // on FlightListing — by the time we reach here the URL is stable.
    await expect(page).toHaveURL(/FlightListing/i, { timeout: 10_000 });
    console.log('Flight results URL confirmed');
  });

  test('Airline filter is visible after search completes', async ({ page }) => {
    await loginAndReachDashboard(page);
    await searchFlight(page);

    // searchFlight() already waits for this element — this is an extra guard
    await expect(page.locator('#dd-airline-filter')).toBeVisible({ timeout: 10_000 });
    console.log('Airline filter verified on listing page');
  });

  test('At least one flight card appears in results', async ({ page }) => {
    await loginAndReachDashboard(page);
    await searchFlight(page);

    const cards = page.locator(
      '.border.rounded.d-flex.flex-column.flex-md-row.mb-1'
    );

    await expect(cards.first()).toBeVisible({ timeout: 120_000 });

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    console.log(`Flights found: ${count}`);
  });
});

// BOOKING FLOW TEST

test.describe('Booking Flow', () => {
  test('Full flow: search → select flight → Book Now', async ({ page }) => {

    await test.step('Login and reach dashboard', async () => {
      await loginAndReachDashboard(page);
    });

    await test.step(`Search ${TARGET_FROM} → ${TARGET_TO}`, async () => {
      await searchFlight(page);
    });

    const cards = page.locator(
      '.border.rounded.d-flex.flex-column.flex-md-row.mb-1'
    );

    await test.step('Wait for flight cards to load', async () => {
      await expect(cards.first()).toBeVisible({ timeout: 120_000 });
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Flights available: ${count}`);
    });

    await test.step('Click Book Now', async () => {
      await clickBookNow(page);
    });
  });
});

//credit limit enhancement 
test('User can open Credit Limit Enhancement page', async ({ page }) => {

  await openAccountsPage(
    page,
    '/CreditLimitEnhancement',
    /CreditLimitEnhancement/i
  );

  await expect(page.locator('table')).toBeVisible();

  await expect(
    page.getByRole('columnheader', { name: 'Amount' })
  ).toBeVisible();

  console.log('Credit Limit Enhancement page loaded');
});

//bank payments
test('User can open Bank Payments page', async ({ page }) => {

  await openAccountsPage(
    page,
    '/BankPayments',
    /BankPayments/i
  );

  // Verify page loaded
  await expect(page).toHaveURL(/BankPayments/i);

  // Replace with an element unique to your page if available
  await expect(page.locator('h1, h2, table, form').first()).toBeVisible();

  console.log('Bank Payments page loaded');
});

//ledger report

test('User can open Ledger Report page', async ({ page }) => {

  await openAccountsPage(
    page,
    '/LedgerReport',
    /LedgerReport/i
  );

  await expect(page).toHaveURL(/LedgerReport/i);

  // Replace with something unique if available
  await expect(page.locator('h1, h2, table, form').first()).toBeVisible();

  console.log('Ledger Report page loaded');
});