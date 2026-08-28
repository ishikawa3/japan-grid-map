// PWA まわりの状態（Service Worker の更新検知・インストール可否・オンライン状態）を
// React から購読できる形で提供する。
//
// Service Worker の登録は本番ビルドのみ。開発時は既存の登録を解除する
// （dev サーバーのモジュールが古いキャッシュに固定されるのを防ぐため）。

import { useEffect, useState } from 'react';

/** beforeinstallprompt は仕様上まだ標準化されていないため最小限の型だけ用意する */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // useEffect のクリーンアップは void を返す必要があるため、delete の戻り値は捨てる
  return () => {
    listeners.delete(listener);
  };
}

// --- Service Worker 登録 -----------------------------------------------------

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    return;
  }

  // 初回描画と帯域を奪わないよう load 後に登録する
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        // すでに待機中の新バージョンがある（前回の訪問で更新が降ってきていた）
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingWorker = reg.waiting;
          notify();
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            // controller があるとき = 初回インストールではなく「更新」
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = next;
              notify();
            }
          });
        });
      })
      .catch((err) => console.warn('[pwa] Service Worker の登録に失敗しました', err));
  });

  // 新しい SW が制御を取ったら一度だけリロードして新バージョンを反映する
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

// --- インストール可否 --------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 既定のミニインフォバーを抑制し、任意のタイミングで出せるよう保持する
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** インストール可能なら prompt を返す。不可なら null（iOS や インストール済みなど） */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(deferredPrompt !== null);
  useEffect(() => subscribe(() => setCanInstall(deferredPrompt !== null)), []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // prompt() は一度しか使えないので破棄する
    deferredPrompt = null;
    notify();
  };

  return { canInstall, install };
}

/** すでにスタンドアロン（ホーム画面から起動）で動いているか */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari は display-mode を持たず navigator.standalone を使う
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// --- 更新検知 ----------------------------------------------------------------

export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(waitingWorker !== null);
  useEffect(() => subscribe(() => setUpdateReady(waitingWorker !== null)), []);

  const applyUpdate = () => {
    // skipWaiting → controllerchange → リロード の順で反映される
    waitingWorker?.postMessage('SKIP_WAITING');
  };

  return { updateReady, applyUpdate };
}

// --- オンライン状態 ----------------------------------------------------------

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}
