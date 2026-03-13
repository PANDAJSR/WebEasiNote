import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/WebEasiNote/' : '/',
  server: {
    port: 5173,
    open: mode !== 'desktop'
  }
}))
