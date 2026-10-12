import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/pwa/register.ts so a new build can be swapped in on the next screen change.
      injectRegister: false,
      manifest: {
        name: 'wildRx',
        short_name: 'wildRx',
        description: 'Wildlife medication dosing calculator',
        theme_color: '#2D4A3E',
        background_color: '#FAF7F2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // The plugin only sets these itself with injectRegister 'auto'; a new build must take over at once.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Rules tests need the Firestore emulator: npm run test:rules.
    exclude: ['**/node_modules/**', 'rules-tests/**'],
  },
});
