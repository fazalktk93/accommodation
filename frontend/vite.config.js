import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PORT = process.env.VITE_BACKEND_PORT || '8000'
const TARGET = `http://127.0.0.1:${PORT}`

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: TARGET,
        changeOrigin: true,
        secure: false,
        ws: false,
      },
    },
  },
})
