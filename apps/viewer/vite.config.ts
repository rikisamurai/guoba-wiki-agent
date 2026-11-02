import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // 开发时把接口转给 wiki-agent view（默认 5050 端口）
  server: { proxy: { '/api': 'http://127.0.0.1:5050' } },
})
