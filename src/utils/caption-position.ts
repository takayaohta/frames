// ===============================
// キャプションYオフセット設定
// ===============================

// [1] ★ ベースシステム X Half 用の 3:4 画像用テーブル
export const CAPTION_Y_OFFSET_PX: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0, L: 0 },
  '5:7': { S: -25, M: -31, L: -130 },
  '9:16': { S: -20, M: -580, L: -40 },
};

// [2] ★★ 追加調整 : 5:7画像アップロード時
export const CAPTION_Y_OFFSET_PX_57IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0, L: 0 },
  '5:7': { S: -10, M: -60, L: -30 }, // Spacesごとに細かく調整
  '9:16': { S: -20, M: -20, L: -40 },
};

// [3] ★★★ 2:3画像用のキャプション位置調整テーブル
export const CAPTION_Y_OFFSET_PX_23IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0, L: 0 },
  '5:7': { S: -20, M: -50, L: -30 }, // 2:3画像用の調整値（より上に移動）
  '9:16': { S: -30, M: -30, L: -40 }, // 2:3画像用の調整値（より上に移動）
};

// [4] ★★★ 4:5画像用のキャプション位置調整テーブル
export const CAPTION_Y_OFFSET_PX_45IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0, L: 0 },
  '5:7': { S: -95, M: -90, L: -100 }, // 4:5画像用の調整値
  '9:16': { S: -25, M: -25, L: -35 }, // 4:5画像用の調整値
};

// ===============================
// キャプションYオフセット計算関数
// ===============================
type YOffsetParams = {
  ratio: string;
  space: string;
  imageWidth?: number;
  imageHeight?: number;
  canvasH?: number;
};

export function getCaptionYOffset({ ratio, space, imageWidth, imageHeight, canvasH }: YOffsetParams): number {
  // 1. 5:7画像アップロード時は専用テーブルを使う
  if (
    imageWidth && imageHeight &&
    Math.abs(imageWidth / imageHeight - 5 / 7) < 0.01
  ) {
    return CAPTION_Y_OFFSET_PX_57IMG[ratio]?.[space] ?? 0;
  }
  // 2. 2:3画像アップロード時は専用テーブルを使う
  if (
    imageWidth && imageHeight &&
    Math.abs(imageWidth / imageHeight - 2 / 3) < 0.05
  ) {
    return CAPTION_Y_OFFSET_PX_23IMG[ratio]?.[space] ?? 0;
  }
  // 3. 4:5画像アップロード時は専用テーブルを使う
  if (
    imageWidth && imageHeight &&
    Math.abs(imageWidth / imageHeight - 4 / 5) < 0.05
  ) {
    return CAPTION_Y_OFFSET_PX_45IMG[ratio]?.[space] ?? 0;
  }
  // 4. 今後追加する分岐があればここに
  // if (imageWidth && imageHeight && ... ) { ... }
  // 5. それ以外はベーステーブル
  let base = CAPTION_Y_OFFSET_PX[ratio]?.[space] ?? 0;
  // スマホ補正: 1:1 S, 5:7 S のときだけcanvasHがPC基準より小さい場合指定px上げる
  if (ratio === '1:1' && space === 'S' && canvasH && canvasH < 480) {
    base -= 10;
  }
  if (ratio === '5:7' && space === 'S' && canvasH && canvasH < 672) {
    base -= 8;
  }
  return base;
}

// ===============================
// アスペクト比判定関数
// ===============================
export function isSupportedAspectRatio(width: number, height: number): boolean {
  const aspectRatio = width / height;
  const targetRatio34 = 3 / 4; // 3:4
  const targetRatio23 = 2 / 3; // 2:3
  const targetRatio45 = 4 / 5; // 4:5
  const tolerance = 0.1; // 10%の許容範囲
  return Math.abs(aspectRatio - targetRatio34) < tolerance || 
         Math.abs(aspectRatio - targetRatio23) < tolerance ||
         Math.abs(aspectRatio - targetRatio45) < tolerance;
}

// ===============================
// アスペクト比判定関数（詳細版）
// ===============================
export function getImageAspectRatioType(width: number, height: number): '3:4' | '2:3' | '4:5' | 'other' {
  const aspectRatio = width / height;
  const targetRatio34 = 3 / 4;
  const targetRatio23 = 2 / 3;
  const targetRatio45 = 4 / 5;
  const tolerance = 0.05; // 5%の許容範囲（実用的な範囲をカバー）
  
  if (Math.abs(aspectRatio - targetRatio34) < tolerance) {
    return '3:4';
  }
  if (Math.abs(aspectRatio - targetRatio23) < tolerance) {
    return '2:3';
  }
  if (Math.abs(aspectRatio - targetRatio45) < tolerance) {
    return '4:5';
  }
  return 'other';
} 