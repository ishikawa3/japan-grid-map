// manifest.webmanifest の screenshots 用スクリーンショットを実際の地図から生成する。
// インストールUI（Chrome の「アプリをインストール」ダイアログ等）で使われる。
//
//   pnpm --filter web build
//   pnpm --filter web preview --port 5190 &
//   node scripts/assets/generate-screenshots.cjs
//
// 要 playwright + Chromium（このリポジトリの依存ではない）。生成物はコミットする。

const { chromium } = require('playwright');

const PREVIEW_URL = process.env.OG_PREVIEW_URL ?? 'http://localhost:5190/japan-grid-map/';

const SHOTS = [
  // form_factor: wide — デスクトップのインストールUI用
  { name: 'web/public/screenshot-wide.png', width: 1280, height: 800, hash: '#5.2/37.4/137.5' },
  // form_factor: narrow — モバイルのインストールUI用
  { name: 'web/public/screenshot-narrow.png', width: 720, height: 1280, hash: '#5/37.5/138' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 1,
    });
    await page.goto(PREVIEW_URL + shot.hash, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(9000); // タイル取得と描画の完了を待つ
    await page.screenshot({ path: shot.name });
    await page.close();
    console.log(`生成しました: ${shot.name} (${shot.width}x${shot.height})`);
  }

  await browser.close();
})();
