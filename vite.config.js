import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'

const NEXUS = (process.env.VITE_NEXUS_URL || 'http://mino.local:10104').replace(/\/$/, '')
const API_HTTP_PREFIXES = [
  '/auth', '/sys', '/static', '/settings', '/packs', '/api', '/device',
  '/runtime', '/me', '/health', '/project',
]

function apiProxy() {
  const bypass = (req) => {
    const accept = String(req.headers.accept || '')
    if (accept.includes('text/html')) return '/index.html'
  }
  return {
    '/ws': { target: NEXUS, changeOrigin: true, ws: true },
    ...Object.fromEntries(API_HTTP_PREFIXES.map((prefix) => [prefix, {
      target: NEXUS,
      changeOrigin: true,
      bypass,
    }])),
  }
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_MINO_CLIENT': JSON.stringify('console'),
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: apiProxy(),
  },
  preview: {
    port: 4174,
    proxy: apiProxy(),
  },
})
