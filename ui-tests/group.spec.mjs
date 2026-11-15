import { test, expect } from '@playwright/test';
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`group setup and local Garage persistence at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.getByRole('button', { name: 'Ride together' }).click();
    const name = page.getByRole('textbox', { name: 'Group display name' });
    if (await name.count()) { await name.fill('Test rider'); await name.scrollIntoViewIfNeeded(); }
    else { await page.getByText('Group rides need a Supabase project connection.', { exact: false }).scrollIntoViewIfNeeded(); }
    await page.screenshot({ path: info.outputPath('group.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Garage', exact: true }).click();
    await page.getByRole('textbox', { name: 'Bike make' }).fill('Sur-Ron');
    await page.getByRole('textbox', { name: 'Bike model' }).fill('Light Bee');
    await page.getByRole('textbox', { name: 'Bike nickname' }).fill('Trail bike');
    await page.getByRole('button', { name: 'Save bike', exact: true }).click();
    await expect(page.getByText('Bike saved on this device.', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('garage.png'), fullPage: true });
    await page.reload();
    await page.getByRole('tab', { name: 'Garage', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Bike nickname' })).toHaveValue('Trail bike');
    await page.getByRole('tab', { name: 'Profile', exact: true }).click();
    await expect(page.getByText('Your first route is waiting.')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
