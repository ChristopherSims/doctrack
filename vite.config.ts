import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow fallback to next available port
    host: '127.0.0.1',
    watch: {
      ignored: ['**/backend/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
});
