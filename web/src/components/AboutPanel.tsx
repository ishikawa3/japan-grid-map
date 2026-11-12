import { useEffect, useRef, useState } from 'react';
import meta from '../data-meta.json';
import { isStandalone, useInstallPrompt } from '../lib/pwa';

const REPO_URL = 'https://github.com/ishikawa3/japan-grid-map';

export function AboutPanel() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { canInstall, install } = useInstallPrompt();

  // ネイティブ <dialog> の showModal() に任せることで、背景の inert 化（Tab が地図側へ
  // 抜けない）・Escape で閉じる・閉じたときのトリガーへのフォーカス復帰・最前面表示
  // (top layer) をブラウザが面倒を見てくれる。React の state とは close イベントで同期する。
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // 背景クリックで閉じる (light dismiss) は closedby="any" に任せる。
  // closedby 未対応ブラウザ (2026-11 時点で Safari) でだけ同等の処理を足す。
  // event.target ではなくポインタ座標で判定し、押下と離す位置の両方が外側のときだけ閉じる
  // （本文でテキスト選択を始めて背景で離したときに閉じないように）。
  // 閉じるのは pointerup ではなく click で行う。pointerup で閉じると、iOS がその後に
  // 合成する click が top layer から外れた後の地図に当たり、意図しない地物選択が起きる。
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;
    const outside = (e: MouseEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = outside(e);
    };
    const onClick = (e: MouseEvent) => {
      if (pressedOutside && outside(e)) dialog.close();
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('click', onClick);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('click', onClick);
    };
  }, []);

  const total = meta.counts.lines + meta.counts.nodes + meta.counts.towers + meta.counts.generators;

  return (
    <>
      <button
        type="button"
        className="about-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="このサイトについて"
        onClick={() => setOpen(true)}
      >
        ⓘ
      </button>

      <dialog
        ref={dialogRef}
        className="about-panel"
        aria-labelledby="about-title"
        closedby="any"
        // Esc・背景クリック・モバイルの戻るジェスチャなど、どの経路で閉じても close が飛ぶ
        onClose={() => setOpen(false)}
      >
        {/* 閉じても中身は残す（アンマウントするとフェードアウトが効かない） */}
        <div className="about-body">
          <button type="button" className="about-close" onClick={() => setOpen(false)} aria-label="閉じる">
            ×
          </button>
          <h2 id="about-title" className="about-title">
            このサイトについて
          </h2>

          <p className="about-lead">
            OpenStreetMap に登録された日本全国の送電線・変電所・発電所・鉄塔を、電圧クラスで色分けして表示します。
          </p>

          <dl className="about-facts">
            <dt>データ時点</dt>
            <dd>
              <time dateTime={meta.generatedAt}>{meta.generatedAt}</time>
            </dd>
            <dt>収録件数</dt>
            <dd>
              送電線 {meta.counts.lines.toLocaleString()} / 変電所・発電所 {meta.counts.nodes.toLocaleString()} /
              発電設備 {meta.counts.generators.toLocaleString()} / 鉄塔 {meta.counts.towers.toLocaleString()}
              <span className="about-total">（計 {total.toLocaleString()} 件）</span>
            </dd>
          </dl>

          {canInstall && !isStandalone() && (
            <>
              <h3 className="about-heading">アプリとして使う</h3>
              <p className="about-note">
                ホーム画面やアプリ一覧に追加すると、ブラウザのUIなしで全画面表示できます。
                一度開いた画面はオフラインでも起動します（地図データの取得には通信が必要です）。
              </p>
              <button type="button" className="about-install" onClick={install}>
                インストール
              </button>
            </>
          )}

          <h3 className="about-heading">出典</h3>
          <ul className="about-list">
            <li>
              送電網データ: ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
                OpenStreetMap
              </a>{' '}
              contributors ―{' '}
              <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noreferrer noopener">
                ODbL
              </a>{' '}
              の下で利用
            </li>
            <li>
              背景地図:{' '}
              <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer noopener">
                地理院タイル
              </a>
              （国土地理院）
            </li>
          </ul>

          <h3 className="about-heading">免責事項</h3>
          <p className="about-note">
            本サイトは OpenStreetMap の有志による調査データをもとにした非公式の可視化であり、
            電力会社が公表する正式な設備情報ではありません。網羅性・正確性・最新性は保証されず、
            実在しない設備の表示や、実在する設備の欠落が含まれます。
            事業判断・工事・緊急対応など、正確性が求められる用途には使用しないでください。
            また、送電設備への立ち入りや接近は危険であり、法令で禁止されている場合があります。
          </p>

          <p className="about-repo">
            ソースコード:{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
          </p>
        </div>
      </dialog>
    </>
  );
}
