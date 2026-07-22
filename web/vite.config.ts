import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages はプロジェクトページの場合 https://<user>.github.io/<repo>/ 配下になるため base を合わせる。
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/japan-grid-map/',
  plugins: [react()],
});
