// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change this to your backend origin if different:
const BACKEND = process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // anything starting with /api will be proxied to FastAPI
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        ws: false,
      },
    },
  },
})
