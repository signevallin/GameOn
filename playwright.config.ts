import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 3210;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// This environment ships Chromium at a fixed path and @playwright/test's pinned
// revision may differ, so point at it explicitly when present. In CI (where
// `playwright install` provides the browser) leave it unset so Playwright uses
// its own managed binary.
const candidate = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(candidate) ? candidate : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    launchOptions: { executablePath },
  },
  // When E2E_BASE_URL is provided we test that server; otherwise boot a local
  // production build with placeholder env (enough for the auth-gate + smoke
  // tests, which never reach a real database).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: BASE_URL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-key',
        },
      },
});
