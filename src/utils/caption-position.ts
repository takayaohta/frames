// ===============================
// キャプションYオフセット設定
// ===============================

// [1] ★ ベースシステム X Half 用の 3:4 画像用テーブル（Spaces S/M用）
export const CAPTION_Y_OFFSET_PX: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0 },
  '5:7': { S: -8, M: -8 },
};

// [2] ★★ 追加調整 : 5:7画像アップロード時（Spaces S/M用）
export const CAPTION_Y_OFFSET_PX_57IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: -2 },
  '5:7': { S: 0, M: -1 }, // Spacesごとに細かく調整
};

// [3] ★★★ 2:3画像用のキャプション位置調整テーブル（Spaces S/M用）
export const CAPTION_Y_OFFSET_PX_23IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0 },
  '5:7': { S: 0, M: -2 }, // 2:3画像用の調整値（より上に移動）
};

// [4] ★★★ 4:5画像用のキャプション位置調整テーブル（Spaces S/M用）
export const CAPTION_Y_OFFSET_PX_45IMG: Record<string, Record<string, number>> = {
  '1:1': { S: 0, M: 0 },
  '5:7': { S: -30, M: -25 }, // 4:5画像用の調整値
};

// ===============================
// Spaces L用の写真下からの固定距離設定
// ===============================
// Spaces Lの場合は写真の下からの距離を統一する
export const CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L: Record<string, number> = {
  '1:1': 16,   // 1:1の場合は10px
  '5:7': 16,   // 5:7の場合は10px
  '9:16': 16,  // 9:16の場合は10px
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
  canvasHForMobileAdjustment?: number;
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
  imageHeight,
  canvasHForMobileAdjustment
}: CaptionYPositionParams): number {
  // Ratio 9:16 の場合は Spaces 全てで写真の下からの固定距離を使用
  if (ratio === '9:16') {
    const imageBottom = imageDrawTop + imageDrawHeight;
    const distanceFromBottom = CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L['9:16'] ?? 16;
    return imageBottom + distanceFromBottom;
  }

  // Spaces Lの場合は写真の下からの固定距離を使用
  if (space === 'L') {
    const imageBottom = imageDrawTop + imageDrawHeight;
    const distanceFromBottom = CAPTION_DISTANCE_FROM_IMAGE_BOTTOM_L[ratio] ?? 16;
    return imageBottom + distanceFromBottom;
  }

  // Spaces S/Mの場合は従来の余白中央配置
  const yOffset = getCaptionYOffset({ ratio, space, imageWidth, imageHeight, canvasH: canvasHForMobileAdjustment || canvasHeight });
  return canvasHeight - padBottom / 2 - captionHeight / 2 + yOffset;
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