// 国土数値情報 P03（発電施設）の発電種別コード → 人間可読ラベル。
// 実際の属性名・コード値は KSJ P03 の製品仕様書（バージョンにより A34_001 等が変わる）を
// 確認のうえ調整すること: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P03-v3_1.html
export const MLIT_PLANT_TYPE_LABELS: Record<string, string> = {
  '1': '水力',
  '2': '火力',
  '3': '原子力',
  '4': '地熱',
  '5': '風力',
  '6': '太陽光',
  '7': 'その他',
};

export function mlitPlantTypeLabel(code: string | undefined): string {
  if (!code) return '不明';
  return MLIT_PLANT_TYPE_LABELS[code] ?? '不明';
}
