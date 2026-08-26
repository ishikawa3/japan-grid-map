// アプリシェル（HTML/JS/CSS/アイコン）だけをキャッシュする最小構成の Service Worker。
//
// 意図的にキャッシュしないもの:
//   - tiles/grid.pmtiles (35MB) … Range Request で部分取得される大きなバイナリ。
//     Cache Storage に丸ごと置くとストレージを圧迫するうえ、206 レスポンスは
//     Cache API に put できない。ブラウザのHTTPキャッシュに任せる。
//   - 地理院タイル … 別オリジンかつ枚数が多い。
//
// 更新戦略: ナビゲーションは network-first（新しいデプロイを取りこぼさない）、
// 静的アセットは cache-first（ファイル名にハッシュが付くので安全）。

const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;

// ここは実際のパスに依存しないよう、SW自身のスコープから解決する
const BASE = new URL('./', self.registration.scope).pathname;

const SHELL_ASSETS = [BASE, `${BASE}favicon.svg`, `${BASE}manifest.webmanifest`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // 1つでも失敗すると install 全体が落ちるため、個別に握りつぶす
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 別オリジンは素通し
  if (url.pathname.includes('/tiles/')) return; // 巨大タイルは扱わない
  if (request.headers.has('range')) return; // Range Request はキャッシュ不可

  // ページ遷移: ネットワーク優先、失敗したらキャッシュ済みのシェルを返す
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(BASE, copy));
          return res;
        })
        .catch(() => caches.match(BASE).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // 静的アセット: キャッシュ優先
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
