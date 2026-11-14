import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './ui-tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8089', channel: 'chrome', headless: true },
  webServer: { command: 'node scripts/preview-server.mjs', url: 'http://127.0.0.1:8089', reuseExistingServer: false },
});
