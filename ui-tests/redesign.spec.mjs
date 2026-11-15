import { test, expect } from '@playwright/test';

test('four destinations, durable build and shared Profile presentation', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const name of ['Home', 'Friends', 'Garage', 'Profile']) await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Ranks', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('home-mobile.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Friends', exact: true }).click();
  await expect(page.getByText('Find your riding people.')).toBeVisible();
  await page.getByRole('heading', { name: 'Friends', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('friends-mobile.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Garage', exact: true }).click();
  await page.getByRole('textbox', { name: 'Bike make' }).fill('Sur-Ron');
  await page.getByRole('textbox', { name: 'Bike model' }).fill('Light Bee X');
  await page.getByRole('textbox', { name: 'Bike nickname' }).fill('Bluebird');
  await page.getByRole('button', { name: 'Save bike', exact: true }).click();
  await expect(page.getByText('Bike saved on this device.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Mod or accessory' }).fill('Wide foot pegs');
  await page.getByRole('button', { name: 'Add installed mod' }).click();
  await expect(page.getByText('Wide foot pegs', { exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Your garage', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('garage-mobile.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Bike nickname' })).toHaveValue('Bluebird');
  await expect(page.getByText('Wide foot pegs', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('Bluebird', { exact: true })).toBeVisible();
  await expect(page.getByText('Wide foot pegs', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Public profile' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Sharing and privacy settings' }).click();
  await expect(page.getByRole('switch', { name: 'Leaderboard participation' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('heading', { name: 'Profile', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('profile-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('legacy rides, active draft and bike survive routed navigation and finishing', async ({ page }) => {
  const timestamp = Date.now() - 120000;
  const point = { latitude: 30, longitude: -95, timestamp, accuracy: 5, segment: 0 };
  await page.addInitScript(({ timestamp, point }) => {
    if (localStorage.getItem('repride-test-seeded')) return;
    localStorage.setItem('@emoto/v1', JSON.stringify({ version: 1,
      bike: { make: 'Legacy', model: 'Bike', nickname: 'Original bike' },
      draft: { id: 'unfinished', startedAt: timestamp, meters: 250, points: [point] },
      rides: [{ id: 'legacy-ride', startedAt: timestamp - 100000, endedAt: timestamp - 50000, meters: 1609.344, points: [point] }],
    }));
    localStorage.setItem('repride-test-seeded', 'true');
  }, { timestamp, point });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Return to active ride' })).toBeVisible();
  for (const name of ['Friends', 'Garage', 'Profile']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Return to active ride' })).toBeVisible();
  }
  await expect(page.getByText('Original bike', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /View ride from/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Return to active ride' }).click();
  await page.getByRole('button', { name: 'Finish ride', exact: true }).click();
  await expect(page.getByText('Ride summary', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Profile' }).click();
  await expect(page.getByRole('button', { name: /View ride from/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Return to active ride' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /View ride from/ })).toHaveCount(2);
});

test('a stalled friend upload preserves Finish and Stop controls', async ({ page }) => {
  const now = Date.now();
  const riderId = '44444444-4444-4444-8444-444444444444';
  let releaseUpload;
  const stalled = new Promise(resolve => { releaseUpload = resolve; });
  let uploads = 0;
  let stops = 0;
  await page.route('**/rest/v1/rpc/repride_social', async route => {
    const request = route.request().postDataJSON();
    let data = [];
    if (request.action === 'me') data = { id: riderId, profile: { id: riderId, username: 'qa_rider', display_name: 'QA rider', bio: '', visibility: 'private', build: {} } };
    if (request.action === 'presence' && !request.payload.stop) { uploads++; await stalled; data = { ok: true }; }
    if (request.action === 'presence' && request.payload.stop) { stops++; data = { ok: true }; }
    await route.fulfill({ json: data });
  });
  await page.addInitScript(({ now, riderId }) => {
    const point = { latitude: 30, longitude: -95, timestamp: now, accuracy: 5, segment: 0 };
    const user = { id: riderId, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date(now).toISOString(), is_anonymous: true };
    const token = btoa(JSON.stringify({ alg: 'HS256' })) + '.' + btoa(JSON.stringify({ sub: riderId, exp: Math.floor(now / 1000) + 3600, role: 'authenticated' })) + '.test';
    localStorage.setItem('sb-jqlxsbllaldlgixcoxdc-auth-token', JSON.stringify({ access_token: token, refresh_token: 'qa-refresh', expires_at: Math.floor(now / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }));
    localStorage.setItem('@emoto/v1', JSON.stringify({ version: 1, bike: { make: '', model: '', nickname: '' }, rides: [], draft: { id: 'slow-upload-ride', startedAt: now - 60000, meters: 1000, points: [point] } }));
    localStorage.setItem('@emoto/tracking-v1', JSON.stringify({ group: null, pendingLeave: null, fix: point, status: 'GPS ready', groupMessage: '', syncedAt: 0, background: false, friendsUntil: now + 900000, friendPendingStop: true, friendMessage: '' }));
  }, { now, riderId });
  try {
    await page.goto('/');
    await expect.poll(() => uploads).toBe(1);
    await page.getByRole('button', { name: 'Finish ride', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ride summary' })).toBeVisible({ timeout: 2000 });
    await page.getByRole('button', { name: 'Back to Profile' }).click();
    await page.getByRole('tab', { name: 'Home', exact: true }).click();
    // Web normally disables new sharing. The active Stop control must still work.
    await page.getByRole('button', { name: 'Stop sharing with friends' }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('@emoto/tracking-v1')).friendsUntil)).toBe(0);
    releaseUpload();
    await expect.poll(() => stops).toBeGreaterThan(0);
  } finally { releaseUpload(); }
});
