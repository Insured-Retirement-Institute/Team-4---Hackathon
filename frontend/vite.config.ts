import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/application': 'http://localhost:3001',
      '/api-docs': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
})
