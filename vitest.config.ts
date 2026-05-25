import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    alias: {
      obsidian: resolve(__dirname, './tests/mocks/obsidian.ts'),
    },
  },
});
