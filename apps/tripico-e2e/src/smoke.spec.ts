import { expect, test } from '@playwright/test';

/**
 * End-to-end smoke test for the Tripico app.
 *
 * Assumes the backend is running locally at http://localhost:3000 and that
 * the seed user (test@example.com / securepass123) exists — it was created
 * during the initial register-flow smoke test and persists in the local
 * `tripico` Postgres database.
 */

const EXISTING_USER = {
  email: 'test@example.com',
  password: 'securepass123',
  displayName: 'Test User',
};

test('anonymous browse → login → header reflects auth', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Wycieczki' }),
  ).toBeVisible();

  // Auth CTAs visible while anonymous.
  await expect(page.getByRole('link', { name: 'Zaloguj' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Załóż konto' })).toBeVisible();

  await page.getByRole('link', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Zaloguj się' }),
  ).toBeVisible();

  await page.getByLabel('Email').fill(EXISTING_USER.email);
  await page.getByLabel('Hasło').fill(EXISTING_USER.password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  await expect(page).toHaveURL('/');

  // Authenticated header should now show the user + the create-trip CTA.
  await expect(page.getByText(EXISTING_USER.displayName)).toBeVisible();
  await expect(
    page.getByRole('link', { name: '+ Nowa wycieczka' }),
  ).toBeVisible();

  // /create should be accessible now that we're authenticated.
  await page.getByRole('link', { name: '+ Nowa wycieczka' }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nowa wycieczka' }),
  ).toBeVisible();
});

test('public trip detail is reachable by slug', async ({ page }) => {
  // The seed trip was published in an earlier smoke test.
  await page.goto('/wycieczka/wycieczka-w-bieszczady');
  await expect(
    page.getByRole('heading', { level: 1, name: /Bieszczady/ }),
  ).toBeVisible({ timeout: 10000 });

  // Anonymous user should see the login CTA on the detail page.
  await expect(page.getByText(/Zaloguj się/)).toBeVisible();
});
