import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // relative asset and data URLs, so the build can be served from any sub-path
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    // three + postprocessing is one large, lazily loaded chunk by design
    chunkSizeWarningLimit: 1600,
  },
})
