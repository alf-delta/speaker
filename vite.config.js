import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: 'index.html', legacy: 'subw.html' },
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
