// PWA/ファビコン用の PNG を web/public/favicon.svg から書き出す。
//
//   node scripts/assets/generate-icons.cjs
//
// 要 playwright + Chromium（このリポジトリの依存ではないため、実行環境に用意すること）:
//   npm i -g playwright && npx playwright install chromium
// favicon.svg を変更したときだけ実行すればよい。生成物はコミットする。

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = 'web/public';
const svg = fs.readFileSync(path.join(OUT, 'favicon.svg'), 'utf8');

// maskable用は安全領域(中央80%)に収まるよう、余白を足したSVGを別途組む
const maskableSvg = svg
  .replace('viewBox="0 0 64 64"', 'viewBox="-8 -8 80 80"')
  .replace('<rect width="64" height="64" rx="12"', '<rect x="-8" y="-8" width="80" height="80" rx="0"');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const jobs = [
    { name: 'icon-192.png', size: 192, src: svg },
    { name: 'icon-512.png', size: 512, src: svg },
    { name: 'apple-touch-icon.png', size: 180, src: svg },
    { name: 'icon-512-maskable.png', size: 512, src: maskableSvg },
  ];
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.size, height: j.size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:#0b1220}svg{display:block;width:${j.size}px;height:${j.size}px}</style>${j.src}`
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, j.name), omitBackground: false });
    await page.close();
    console.log('生成:', j.name, j.size + 'px');
  }
  await browser.close();
})();
