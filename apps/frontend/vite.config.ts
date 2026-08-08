import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    host: true,
    proxy: {
      '/api': process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8080',
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 5173),
    host: true,
    proxy: {
      '/api': process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8080',
    },
  },
})
