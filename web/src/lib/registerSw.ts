// Service Worker の登録。開発時は登録せず、既存の登録があれば解除する
// （dev サーバーのモジュールが古いキャッシュに固定されるのを防ぐため）。

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    return;
  }

  // 初回描画と帯域を奪わないよう load 後に登録する
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((err) => {
      console.warn('[sw] Service Worker の登録に失敗しました', err);
    });
  });
}
