// アプリシェル（HTML/JS/CSS/アイコン）だけをキャッシュする最小構成の Service Worker。
//
// 意図的にキャッシュしないもの:
//   - tiles/grid.pmtiles (35MB) … pmtiles が Range Request で部分取得する大きなバイナリ。
//     Cache Storage に丸ごと置くとストレージを圧迫するうえ、206 レスポンスは
//     Cache API に put できない。ブラウザのHTTPキャッシュに任せる
//     （= 一度見た範囲はオフラインでも表示されることがあるが、保証はしない）。
//   - 地理院タイル … 別オリジンかつ枚数が多い。
//
// 更新戦略: ナビゲーションは network-first（新しいデプロイを取りこぼさない）、
// 静的アセットは cache-first（ファイル名にハッシュが付くので安全）。
//
// 自動では skipWaiting しない。新しい SW は waiting のまま待機し、ページ側が
// 更新を促して同意を得てから 'SKIP_WAITING' メッセージで有効化する
// （地図を操作している最中に勝手にリロードされるのを避けるため）。

const VERSION = 'v2';
const SHELL_CACHE = `shell-${VERSION}`;

// リポジトリ名に依存しないよう、SW自身のスコープからベースパスを解決する
const BASE = new URL('./', self.registration.scope).pathname;

const SHELL_ASSETS = [BASE, `${BASE}favicon.svg`, `${BASE}manifest.webmanifest`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // 1つでも失敗すると install 全体が落ちるため、個別に握りつぶす
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))),
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

// ページから更新の同意が得られたら待機を解除する
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
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
