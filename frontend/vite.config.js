// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic', // ensure the new JSX transform
      // (no custom babel needed)
    }),
  ],
  resolve: {
    // In dev, make sure imports of "react/jsx-runtime" resolve to the dev runtime
    alias: isDev ? { 'react/jsx-runtime': 'react/jsx-dev-runtime' } : {},
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // <-- NO '/api' here
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
