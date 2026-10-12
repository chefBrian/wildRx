import { defineConfig } from 'vitest/config';

// Firestore rules tests (npm run test:rules): node environment, emulator only.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
  },
});
