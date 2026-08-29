import { useOnlineStatus, useServiceWorkerUpdate } from '../lib/pwa';

/**
 * PWA の状態表示。
 * - 新バージョンが待機中なら更新を促す（勝手にリロードはしない）
 * - オフライン時は、未取得エリアの地図が出ないことを伝える
 */
export function PwaStatus() {
  const { updateReady, applyUpdate } = useServiceWorkerUpdate();
  const online = useOnlineStatus();

  if (!updateReady && online) return null;

  return (
    <div className="pwa-status" role="status" aria-live="polite">
      {!online && (
        <div className="pwa-chip pwa-chip-offline">
          <span className="pwa-dot" aria-hidden="true" />
          オフラインです。未取得エリアの地図は表示されません
        </div>
      )}
      {updateReady && (
        <div className="pwa-chip">
          新しいバージョンがあります
          <button type="button" className="pwa-action" onClick={applyUpdate}>
            更新
          </button>
        </div>
      )}
    </div>
  );
}
