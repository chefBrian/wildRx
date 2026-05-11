import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        runtimeCaching: [{
          urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'firestore',
            expiration: { maxAgeSeconds: 60 * 60 * 24 },
          },
        }],
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
