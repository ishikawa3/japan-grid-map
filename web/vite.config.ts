import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages はプロジェクトページの場合 https://<user>.github.io/<repo>/ 配下になるため base を合わせる。
// index.html 内のルート相対パス (/favicon.svg 等) は Vite がこの base を前置してくれるので、
// リポジトリ名を各所にハードコードしないこと。
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/japan-grid-map/',
  plugins: [react()],
  build: {
    // maplibre-gl 単体で 800KB 超あり分割しようがないため、既定の500KB警告は実態に合わせて上げる
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // 地図ライブラリはアプリコードよりはるかに大きく更新頻度も低い。
        // 分けておくとアプリ側の変更時に再ダウンロードされずキャッシュが効く。
        manualChunks: {
          maplibre: ['maplibre-gl', 'pmtiles'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
