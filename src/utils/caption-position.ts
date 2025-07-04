// ===============================
// キャプションYオフセット設定
// ===============================

// [1] ★ ベースシステム X Half 用の 3:4 画像用テーブル（Spaces S/M用）
// px指定から割合指定に変更（キャンバス高さに対する割合）
export const CAPTION_Y_OFFSET_RATIO: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0 },
  '5:7': { S: -0.012, M: -0.012 }, // -8px → -0.012 (約-8/672)
};

// [2] ★★ 追加調整 : 5:7画像アップロード時（Spaces S/M用）
export const CAPTION_Y_OFFSET_RATIO_57IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: -0.003 }, // -2px → -0.003 (約-2/672)
  '5:7': { S: 0, M: -0.0015 }, // -1px → -0.0015 (約-1/672)
};

// [3] ★★★ 2:3画像用のキャプション位置調整テーブル（Spaces S/M用）
export const CAPTION_Y_OFFSET_RATIO_23IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0 },
  '5:7': { S: 0, M: -0.003 }, // -2px → -0.003 (約-2/672)
};

// [4] ★★★ 4:5画像用のキャプション位置調整テーブル（Spaces S/M用）
export const CAPTION_Y_OFFSET_RATIO_45IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0 },
  '5:7': { S: -0.045, M: -0.037 }, // -30px → -0.045, -25px → -0.037 (約-30/672, -25/672)
};

// ===============================
// Spaces L用の写真下からの固定距離設定
// ===============================
// Spaces Lの場合は写真の下からの距離を統一する
export const CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L: Record<string, number> = {
  '1:1': 0.02,
  '5:7': 0.02,
  '9:16': 0.02,
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
  // Spaces Lの場合は写真の下からの固定距離を使用
  if (space === 'L') {
    return CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L[ratio] ?? 0;
  }

  // 1. 5:7画像アップロード時は専用テーブルを使う
  if (
    imageWidth && imageHeight &&
    Math.abs(imageWidth / imageHeight - 5 / 7) < 0.01
  ) {
    return CAPTION_Y_OFFSET_RATIO_57IMG[ratio]?.[space] ?? 0;
  }
  // 2. 2:3画像アップロード時は専用テーブルを使う
  if (
    imageWidth && imageHeight &&
    Math.abs(imageWidth / imageHeight - 2 / 3) < 0.05
  ) {
    return CAPTION_Y_OFFSET_RATIO_23IMG[ratio]?.[space] ?? 0;
  }
  // 3. 4:5画像アップロード時は専用テーブルを使う
  if (
    imageWidth && imageHeight &&
    Math.abs(imageWidth / imageHeight - 4 / 5) < 0.05
  ) {
    return CAPTION_Y_OFFSET_RATIO_45IMG[ratio]?.[space] ?? 0;
  }
  // 4. 今後追加する分岐があればここに
  // if (imageWidth && imageHeight && ... ) { ... }
  // 5. それ以外はベーステーブル
  let base = CAPTION_Y_OFFSET_RATIO[ratio]?.[space] ?? 0;
  // スマホ補正: 1:1 S, 5:7 S のときだけcanvasHがPC基準より小さい場合指定割合上げる
  if (ratio === '1:1' && space === 'S' && canvasH && canvasH < 480) {
    base -= 0.021; // -10px → -0.021 (約-10/480)
  }
  if (ratio === '5:7' && space === 'S' && canvasH && canvasH < 672) {
    base -= 0.012; // -8px → -0.012 (約-8/672)
  }
  return base;
}

// ===============================
// Spaces L用のキャプションY座標計算関数
// ===============================
type CaptionYPositionParams = {
  ratio: string;
  space: string;
  canvasHeight: number;
  padBottom: number;
  imageDrawTop: number;
  imageDrawHeight: number;
  captionHeight: number;
  imageWidth?: number;
  imageHeight?: number;
};

export function getCaptionYPosition({
  ratio,
  space,
  canvasHeight,
  padBottom,
  imageDrawTop,
  imageDrawHeight,
  captionHeight,
  imageWidth,
  imageHeight
}: CaptionYPositionParams): number {
  // Ratio 9:16 の場合は Spaces 全てで写真の下からの固定距離を使用
  if (ratio === '9:16') {
    const imageBottom = imageDrawTop + imageDrawHeight;
    const distanceFromBottom = (CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L['9:16'] ?? 0.02) * canvasHeight;
    return imageBottom + distanceFromBottom;
  }

  // Spaces Lの場合は写真の下からの固定距離を使用
  if (space === 'L') {
    const imageBottom = imageDrawTop + imageDrawHeight;
    const distanceFromBottom = (CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L[ratio] ?? 0.02) * canvasHeight;
    return imageBottom + distanceFromBottom;
  }

  // Spaces S/Mの場合は従来の余白中央配置
  const yOffsetRatio = getCaptionYOffset({ ratio, space, imageWidth, imageHeight, canvasH: canvasHeight });
  const yOffsetPx = yOffsetRatio * canvasHeight;
  return canvasHeight - padBottom / 2 - captionHeight / 2 + yOffsetPx;
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