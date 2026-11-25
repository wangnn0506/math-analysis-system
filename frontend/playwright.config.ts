import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5176',
    viewport: { width: 390, height: 844 },
    channel: process.env.MATH_BROWSER_CHANNEL || undefined,
  },
  webServer: [
    {
      command:
        '"$MATH_E2E_PYTHON" ../backend/manage.py runserver 127.0.0.1:8001 --noreload',
      url: 'http://127.0.0.1:8001/api/v1/auth/csrf/',
    },
    {
      command:
        'pnpm exec vite preview --host 127.0.0.1 --port 5176 --strictPort',
      url: 'http://127.0.0.1:5176/api/v1/auth/csrf/',
    },
  ],
});
