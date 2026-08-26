// OGP画像 (web/public/og-image.png, 1200x630) を実際の地図から生成する。
//
//   pnpm --filter web build
//   pnpm --filter web preview --port 5190 &
//   node scripts/assets/generate-og-image.cjs
//
// 全国ビューの地図をスクリーンショットし、タイトル・凡例・URLを重ねて書き出す。
// 要 playwright + Chromium（このリポジトリの依存ではないため実行環境に用意すること）:
//   npm i -g playwright && npx playwright install chromium
// 生成物はコミットする（デザインやタイル更新で見た目が変わったときに作り直す）。

const { chromium } = require('playwright');

const PREVIEW_URL = process.env.OG_PREVIEW_URL ?? 'http://localhost:5190/japan-grid-map/';
const OUT = 'web/public/og-image.png';

// 凡例に出す電圧クラス（scripts/lib/voltage.ts の上位4クラスと対応）
const CLASSES = [
  ['#f4f1e6', '500 kV 以上'],
  ['#ff8a3d', '220–275 kV'],
  ['#ffd166', '110–187 kV'],
  ['#4dd6c1', '60–77 kV'],
];

function composeHtml(mapPngBase64) {
  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; overflow:hidden; }
  .wrap { position:relative; width:1200px; height:630px; background:#0b1220;
    font-family:"Noto Sans CJK JP","Noto Sans JP",system-ui,sans-serif; color:#e8eef5; }
  .map { position:absolute; inset:0; background-image:url(data:image/png;base64,${mapPngBase64});
    background-size:cover; background-position:center; }
  /* 左半分にテキストを置くため、左から中央にかけて背景を落とす */
  .scrim { position:absolute; inset:0;
    background:linear-gradient(100deg,#0b1220 26%,rgba(11,18,32,0.92) 42%,rgba(11,18,32,0.35) 62%,rgba(11,18,32,0) 78%); }
  .content { position:absolute; left:72px; top:0; height:630px; width:600px;
    display:flex; flex-direction:column; justify-content:center; gap:22px; }
  h1 { font-size:62px; font-weight:700; letter-spacing:-0.01em; line-height:1.12; }
  .sub { font-size:23px; line-height:1.65; color:#c9d6e4; }
  .legend { display:flex; flex-wrap:wrap; gap:10px 18px; margin-top:4px; }
  .item { display:flex; align-items:center; gap:8px; font-size:16px; color:#c9d6e4; }
  .sw { width:26px; height:5px; border-radius:3px; }
  .foot { margin-top:8px; font-size:16px; }
  .url { color:#4dd6c1; font-weight:600; }
</style>
<div class="wrap">
  <div class="map"></div>
  <div class="scrim"></div>
  <div class="content">
    <h1>全国送電網マップ</h1>
    <div class="sub">日本全国の送電線・変電所・発電所を<br>電圧クラス別に色分けして表示</div>
    <div class="legend">
      ${CLASSES.map(([c, l]) => `<div class="item"><span class="sw" style="background:${c}"></span>${l}</div>`).join('')}
    </div>
    <div class="foot"><span class="url">ishikawa3.github.io/japan-grid-map</span></div>
  </div>
</div>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const viewport = { width: 1200, height: 630 };

  // 1. 全国ビューの地図をキャプチャする
  const mapPage = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await mapPage.goto(`${PREVIEW_URL}#5.1/37.6/137.2`, { waitUntil: 'load', timeout: 60000 });
  await mapPage.waitForTimeout(9000); // タイル取得と描画の完了を待つ
  await mapPage.addStyleTag({
    content: '.legend-panel,.search-panel,.about-trigger,.maplibregl-ctrl,.feature-info-panel{display:none !important}',
  });
  await mapPage.waitForTimeout(1200);
  const mapPng = await mapPage.screenshot();
  await mapPage.close();

  // 2. テキストを重ねて書き出す
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.setContent(composeHtml(mapPng.toString('base64')));
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT });
  await page.close();

  await browser.close();
  console.log(`生成しました: ${OUT}`);
})();
