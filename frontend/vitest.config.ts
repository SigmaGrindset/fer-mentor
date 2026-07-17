import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    // Force the in-memory mock API regardless of any local .env, so unit
    // tests never touch the network.
    env: { VITE_API_BASE_URL: '' },
  },
})
