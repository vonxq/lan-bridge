import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:9527',
      '/files': 'http://localhost:9527',
      '/ws': {
        target: 'ws://localhost:9527',
        ws: true,
      },
    },
  },
});
