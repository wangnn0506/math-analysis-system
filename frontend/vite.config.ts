import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const django =
    loadEnv(mode, '.', 'MATH_').MATH_BACKEND_ORIGIN || 'http://127.0.0.1:8000';
  const proxy = { target: django, changeOrigin: false };
  return {
    plugins: [tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': proxy,
        '/practice-topics': proxy,
        '/en/practice-topics': proxy,
        '/topic-previews': proxy,
        '/topic-assets': proxy,
        '/sitemap.xml': proxy,
      },
    },
  };
});
