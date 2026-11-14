import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' 讓網站可以放在 GitHub Pages 的子路徑 (/dog-game/)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
} as never);
