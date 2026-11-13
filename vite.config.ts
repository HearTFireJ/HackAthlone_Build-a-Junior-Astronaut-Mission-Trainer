import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built site works under any GitHub Pages
  // sub-path (username.github.io/<repo-name>/) even if the repo is renamed.
  base: './',
  test: {
    // Game rules are plain TypeScript with no browser APIs, so tests run in Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
