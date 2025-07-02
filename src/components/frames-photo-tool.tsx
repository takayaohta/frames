import React, { useRef, useState, useCallback, useEffect } from 'react';
import EXIF from 'exif-js';
import { getCaptionLines, ExifData } from '../utils/caption';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';

// SVGアイコン
const RatioIcon = ({ ratio }: { ratio: string }) => {
  if (ratio === '1:1') return (
    <svg width="14" height="14"><rect x="0" y="0" width="20" height="20" rx="0" fill="#222" /></svg>
  );
  if (ratio === '5:7') return (
    <svg width="19" height="21"><rect x="5" y="0" width="20" height="20" rx="0" fill="#222" /></svg>
  );
  if (ratio === '9:16') {
    return (
      <svg width="10" height="26" viewBox="0 0 8 20">
        <rect x="0" y="0" width="8" height="20" fill="#222" />
      </svg>
    );
  }
  return null;
};

const SPACES = ['S', 'M', 'L'] as const;
const RATIOS = ['1:1', '5:7', '9:16'] as const;
const COLORS = [
  { key: 'white', color: '#fff' },
  { key: 'black', color: '#111' },
  { key: 'win98blue', color: '#0037A6' }, // Win98ブルースクリーン
  { key: 'snap', color: '#00AD50' },      // Snap
  // { key: 'emerald', color: '#008080' },   // Win98壁紙エメラルド（非表示）
  { key: 'auto', color: '' }, // 主色は後でセット
];

// Snap色の2つのパターン
const SNAP_COLORS = {
  pattern1: '#00AD50', // 元のSnap色
  pattern2: '#FF9900', // オレンジ系のSnap色
} as const;

// ラベルの左オフセット
const LABEL_OFFSETS = {
  spaces: 4,
  ratio: 2,
  colour: 0
} as const;

// ラベル共通クラス
const LABEL_CLASS = "text-[1.4rem] md:text-[1.5rem]";

type SpaceType = typeof SPACES[number];
type RatioType = typeof RATIOS[number];
type ColorType = typeof COLORS[number]['key'];

const SliderWithLabels = <T extends string>({
  options,
  value,
  onChange,
  label,
  icons,
  showTicks = true,
  iconPosition = 'above',
  iconMargin = 0,
  trackMargin = 0,
  labelMarginLeft = 8,
  labelMarginBottom = 16,
  hideLabel = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  icons?: React.ReactNode[];
  showTicks?: boolean;
  iconPosition?: 'above' | 'below' | 'none';
  iconMargin?: number;
  trackMargin?: number;
  labelMarginLeft?: number;
  labelMarginBottom?: number;
  hideLabel?: boolean;
}) => {
  const idx = options.indexOf(value);
  const knobRadius = 10;
  const knobHeight = knobRadius * 2; // 20px
  const tickWidth = 2;
  const tickHeight = 16; // ノブより少し短めに
  const hasIcons = icons && icons.length > 0;

  return (
    <div className="w-full flex flex-col items-center">
      {/* ラベル */}
      {!hideLabel && (
        <div
          className="w-full text-left"
          style={{ marginLeft: labelMarginLeft, marginBottom: labelMarginBottom }}
        >
          <span className="text-2xl font-bold mr-2">{label} :</span>
          <span className="text-2xl font-normal" style={{ letterSpacing: '0.1em' }}>{value}</span>
        </div>
      )}
      {/* アイコン（スライダーの上に通常フローで配置） */}
      {icons && iconPosition === 'above' && (
        <div className="w-full flex flex-row justify-between items-end mb-1" style={{ height: 24 }}>
          {icons.map((icon, i) => {
            let style: React.CSSProperties = {};
            if (i === 0) style.transform = 'translateX(3px)';
            if (i === 1) style.transform = 'translateX(-5px)';
            if (i === 2) style.transform = 'translateX(-5px)';
            return (
              <div key={i} className="flex flex-col items-center justify-end" style={style}>
                {icon}
              </div>
            );
          })}
        </div>
      )}
      {/* スライダー本体＋目盛 */}
      <div className="relative w-full flex flex-col items-center" style={{ height: 32 }}>
        {/* 目盛（縦線・グレー、細く） */}
        {showTicks && (
          <>
            {options.map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 bg-[#bdbdbd] z-0"
                style={{
                  left:
                    i === 0
                      ? `${knobRadius - 0.5}px`
                      : i === options.length - 1
                      ? undefined
                      : `calc(${(i / (options.length - 1)) * 100}% - 0.5px)`,
                  right: i === options.length - 1 ? `${knobRadius - 0.5}px` : undefined,
                  width: 1,
                  height: tickHeight,
                }}
              />
            ))}
          </>
        )}
        {/* 横線バー（Win98風：上が白、下がグレー） */}
        <div className="absolute left-[10px] right-[10px] z-0" style={{ height: 2, top: 'calc(50% - 1px)' }}>
          {/* 上の白線 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: '#fff'
          }} />
          {/* 下のグレー線 */}
          <div style={{
            position: 'absolute',
            top: 1,
            left: 0,
            right: 0,
            height: 1,
            background: '#888'
          }} />
        </div>
        <div style={{ marginTop: trackMargin, marginBottom: trackMargin }}>
          {/* スライダー本体（ノブ） */}
          <input
            type="range"
            min={0}
            max={options.length - 1}
            step={1}
            value={idx}
            onChange={e => onChange(options[Number(e.target.value)])}
            className="slider-thumb-98"
            style={{
              position: 'absolute',
              top: 'calc(50% - 1px)',
              transform: 'translateY(-60%)',
              left: `0px`,
              width: `100%`,
              WebkitAppearance: 'none',
              appearance: 'none',
              height: 48,
              background: 'transparent',
              zIndex: 20,
            }}
          />
        </div>
      </div>
    </div>
  );
};

// 先頭付近に追加
const OUTPUT_LONG_SIDE = 2400; // 出力画像の長辺

// Ratio → Spaces の順
const minPadBottomTable: Record<string, Record<string, number>> = {
  '1:1': { S: 0.17, M: 0.17, L: 0.17 },
  '5:7': { S: 0.1, M: 0.17, L: 0.17 },
  '9:16': { S: 0.17, M: 0.17, L: 0.17 },
};

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

// [3] ★★★ 今後追加するかもしれない細かい分岐用テーブル（例: 3:4画像用など）
// export const CAPTION_Y_OFFSET_PX_34IMG: Record<string, Record<string, number>> = { ... };


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
  // 2. 今後追加する分岐があればここに
  // if (imageWidth && imageHeight && ... ) { ... }
  // 3. それ以外はベーステーブル
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
// ここまでYオフセット関連
// ===============================

// Colour名ラベル
const COLOR_LABELS: Record<ColorType, string> = {
  white: 'White',
  black: 'Dark',
  win98blue: 'BSoD',
  snap: 'Snap',
  auto: 'You',
};

// コントラスト用関数
function getContrastColor(color: string) {
  // #fff or #ffffff → 黒文字
  if (color === '#fff' || color === '#ffffff') return '#222';
  // #111 or #000 or #000000 → 白文字
  if (color === '#111' || color === '#000' || color === '#000000') return '#fff';
  // エメラルドグリーン → 黒文字
  if (color.toLowerCase() === '#008080') return '#222';
  // #RRGGBB
  if (color[0] === '#' && color.length === 7) {
    const r = parseInt(color.substr(1,2),16);
    const g = parseInt(color.substr(3,2),16);
    const b = parseInt(color.substr(5,2),16);
    const yiq = (r*299 + g*587 + b*114) / 1000;
    return yiq >= 128 ? '#222' : '#fff';
  }
  // rgb(r,g,b) or rgba(r,g,b,a)
  if (color.startsWith('rgb')) {
    const nums = color.match(/\d+/g);
    if (nums && nums.length >= 3) {
      const r = parseInt(nums[0],10), g = parseInt(nums[1],10), b = parseInt(nums[2],10);
      const yiq = (r*299 + g*587 + b*114) / 1000;
      return yiq >= 128 ? '#222' : '#fff';
    }
  }
  // fallback
  return '#222';
}

// キャプションのサイズとマージン（出力画像基準のスケーリング）
const CAPTION_STYLE = {
  font1: 0.025,    // 出力画像の短辺の2.5%
  font2: 0.02,  // 出力画像の短辺の2%
  lineGap: 0.006, // 出力画像の短辺の1%
};

// 1文字ずつ描画して字間を調整する関数
function drawTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, letterSpacing: number) {
  let currentX = x;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + letterSpacing;
  }
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padBottom: number,
  imageDrawTop: number,
  imageDrawHeight: number,
  captionLines: [string, string],
  frameColor: string,
  space: 'S' | 'M' | 'L',
  ratio: string,
  imageWidth?: number,
  imageHeight?: number
) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  // 出力画像の短辺を基準としたスケーリング
  const outputShortSide = Math.min(OUTPUT_LONG_SIDE, OUTPUT_LONG_SIDE * (ratio === '1:1' ? 1 : ratio === '5:7' ? 5/7 : 9/16));
  const scale = Math.min(width, height) / outputShortSide;
  
  const baseFontPx1 = Math.round(outputShortSide * CAPTION_STYLE.font1 * scale);
  const baseFontPx2 = Math.round(outputShortSide * CAPTION_STYLE.font2 * scale);
  const lineGap = Math.round(outputShortSide * CAPTION_STYLE.lineGap * scale);
  const totalHeight = baseFontPx1 + baseFontPx2 + lineGap;
  const imageBottom = imageDrawTop + imageDrawHeight;
  
  // --- キャプションY座標計算 ---
  // 1:1/5:7は余白のY軸中央、9:16は写真下端+マージンに分岐（将来のため明示的に分ける）
  let yStart: number;
  if (ratio === '9:16') {
    // 9:16は縦長で下部余白が大きいため、キャプションを写真下端+マージンに寄せる
    const margin = Math.round(height * 16 / 672); // 672はPC基準
    yStart = imageDrawTop + imageDrawHeight + margin;
  } else {
    // 1:1/5:7は従来通り余白のY軸中央
    yStart = height - padBottom / 2 - totalHeight / 2 + getCaptionYOffset({ ratio, space, imageWidth, imageHeight, canvasH: height }) * scale;
  }
  
  // Snap色の特別設定
  const isSnapColor = frameColor === SNAP_COLORS.pattern1 || frameColor === SNAP_COLORS.pattern2;
  const isSnapPattern2 = frameColor === SNAP_COLORS.pattern2;
  
  let firstLineColor: string;
  let secondLineColor: string;
  
  if (isSnapPattern2) {
    // Snap色パターン2: 1行目赤、2行目も赤
    firstLineColor = '#E2211C';
    secondLineColor = '#E2211C';
  } else if (isSnapColor) {
    // Snap色パターン1: 1行目白、2行目黒
    firstLineColor = '#fff';
    secondLineColor = '#222';
  } else {
    // その他の色: コントラスト計算
    firstLineColor = getContrastColor(frameColor);
    secondLineColor = firstLineColor;
  }
  
  // 字間設定
  const letterSpacing1 = 0.2; // 1行目（Shot on/機種名）
  const letterSpacing2 = 0.4; // 2行目
  
  // 1行目は不透明で描画
  ctx.globalAlpha = 1.0;
  if (captionLines[0]) {
    const shotOn = 'Shot on ';
    const cameraName = captionLines[0].replace(shotOn, '');
    
    // "Shot on"はKT Flux 100 Regularで描画
    ctx.font = `400 ${baseFontPx1}px 'KT Flux 100', Arial`;
    const shotOnWidth = ctx.measureText(shotOn).width + (shotOn.length - 1) * letterSpacing1;
    
    // 機種名はKT Flux 100 SemiBoldで描画
    ctx.font = `600 ${baseFontPx1}px 'KT Flux 100', Arial`;
    const cameraWidth = ctx.measureText(cameraName).width + (cameraName.length - 1) * letterSpacing1;
    
    const totalWidth = shotOnWidth + cameraWidth;
    const xStart = width / 2 - totalWidth / 2;
    
    // "Shot on"をKT Flux 100 Regularで描画
    ctx.font = `400 ${baseFontPx1}px 'KT Flux 100', Arial`;
    ctx.fillStyle = firstLineColor;
    drawTextWithLetterSpacing(ctx, shotOn, xStart, yStart, letterSpacing1);
    
    // 機種名をKT Flux 100 SemiBoldで描画
    ctx.font = `600 ${baseFontPx1}px 'KT Flux 100', Arial`;
    ctx.fillStyle = firstLineColor;
    drawTextWithLetterSpacing(ctx, cameraName, xStart + shotOnWidth, yStart, letterSpacing1);
  }
  // 2行目を描画
  if (captionLines[1]) {
    // KT Flux 200 Regularで描画
    ctx.font = `400 ${baseFontPx2}px 'KT Flux 200', Arial`;
    ctx.fillStyle = secondLineColor;
    // Snap色以外は透明度0.7、Snap色は不透明
    ctx.globalAlpha = isSnapColor ? 1.0 : 0.7;
    const line2Width = ctx.measureText(captionLines[1]).width + (captionLines[1].length - 1) * letterSpacing2;
    const x2 = width / 2 - line2Width / 2;
    drawTextWithLetterSpacing(ctx, captionLines[1], x2, yStart + baseFontPx1 + lineGap, letterSpacing2);
    ctx.globalAlpha = 1.0; // 念のためリセット
  }
  ctx.restore();
}

// 色に透明度を適用する関数
function getColorWithOpacity(color: string, opacity: number): string {
  // #RRGGBB形式の場合
  if (color[0] === '#' && color.length === 7) {
    const r = parseInt(color.substr(1,2),16);
    const g = parseInt(color.substr(3,2),16);
    const b = parseInt(color.substr(5,2),16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  // rgb(r,g,b)形式の場合
  if (color.startsWith('rgb(') && color.endsWith(')')) {
    const rgb = color.slice(4, -1);
    return `rgba(${rgb},${opacity})`;
  }
  // その他の場合は元の色を返す
  return color;
}

// フレームの余白計算関数
function getFramePadding(width: number, height: number, ratio: string, space: string) {
  // 均等フレーム
  const basePadding = space === 'S' ? 0.04 : space === 'M' ? 0.08 : 0.15;
  // Ratioごとの下部追加余白（%）
  const minPadBottom = minPadBottomTable[ratio]?.[space] ?? 0.17;
  const extraBottom = Math.max(0, minPadBottom - basePadding);

  const shortSide = Math.min(width, height);
  const padTop = Math.round(shortSide * basePadding);
  const padLeft = Math.round(shortSide * basePadding);
  const padRight = Math.round(shortSide * basePadding);
  // 下部は均等フレーム＋追加余白
  const padBottom = Math.round(shortSide * (basePadding + extraBottom));

  return { padTop, padLeft, padRight, padBottom };
}

// 先頭付近に追加
function getFrameColor(color: string, autoColor: string, snapPattern: 1 | 2 = 1) {
  if (!color) return '#dfdfdf';
  if (color === 'white') return '#fff';
  if (color === 'black') return '#111';
  if (color === 'win98blue') return '#0037A6';
  if (color === 'snap') return snapPattern === 1 ? SNAP_COLORS.pattern1 : SNAP_COLORS.pattern2;
  if (color === 'auto') return autoColor;
  return '#dfdfdf';
}

// RGB→HSL変換関数
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

// イージング関数（drawCanvasより上に移動）
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);
const easeInOutCubic = (t: number): number => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// 手書き風イージング: smoothstepで終盤をより滑らかに
const handwritingEase = (t: number): number => {
  if (t < 0.6) {
    return t * 0.92;
  } else if (t < 1) {
    // smoothstep的な補間でなめらかに
    const s = (t - 0.6) / 0.4;
    return 0.552 + (1 - 0.552) * (s * s * (3 - 2 * s));
  } else {
    return 1;
  }
};
  
// Windows98風エラーポップアップコンポーネント
const Win98ErrorPopup: React.FC<{ isVisible: boolean; onClose: () => void }> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 shadow-lg"
        style={{ width: '70vw', maxWidth: '400px', minWidth: '220px' }}
      >
        {/* タイトルバー */}
        <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center">
          <span className="text-sm font-bold">Error</span>
          <button
            onClick={onClose}
            className="w-4 h-4 bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 flex items-center justify-center hover:bg-gray-300"
          >
            <span className="text-black text-xs font-bold">×</span>
          </button>
        </div>
        {/* コンテンツ */}
        <div className="p-4" style={{ minHeight: '56px' }}>
          <div className="w-full text-center mb-4">
            <span className="inline-block align-middle w-8 h-8 bg-red-500 mr-4" style={{ verticalAlign: 'middle' }}>
              <span className="text-white text-lg font-bold" style={{ lineHeight: '2rem' }}>!</span>
            </span>
            <span className="inline-block align-middle text-base text-black font-semibold leading-tight" style={{ lineHeight: 1.2, verticalAlign: 'middle' }}>
              Now, only 3:4 ratio photos
            </span>
          </div>
          {/* OKボタン */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-sm font-normal shadow-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[60px] min-h-[24px]"
            >
              OK
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// デバイス判定関数
function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// Three.jsで3Dテキストを表示するコンポーネント
const Frames3DTitle: React.FC<{ frameColor: string }> = ({ frameColor }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 既存canvasの削除
    while (mount.firstChild) mount.removeChild(mount.firstChild);

    // シーン、カメラ、レンダラー
    const scene = new THREE.Scene();
    const width = 400;
    const height = 120;
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
    camera.position.z = 240;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // ライト
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 0, 100);
    scene.add(light);

    // フォントローダー
    const loader = new FontLoader();
    let mesh: THREE.Mesh | null = null;

    loader.load('https://unpkg.com/three@0.157.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
      const geometry = new TextGeometry('Frames', {
        font,
        size: 40,
        height: 10,
        curveSegments: 2,
        bevelEnabled: false,
      });
      geometry.center();
      const material = new THREE.MeshBasicMaterial({ color: 0x111111 });
      mesh = new THREE.Mesh(geometry, material);
      // 位置を右に調整（回転時の見た目バランスのため）
      mesh.position.x = 15;
      scene.add(mesh);

      // 色の同期関数
      const updateColor = (color: string) => {
        if (mesh && mesh.material) {
          let hexColor = 0x111111; // デフォルトは黒
          
          if (color === 'white' || color === '#fff' || color === '#ffffff') {
            hexColor = 0x111111; // White選択時も黒に統一
          } else if (color === 'black' || color === '#111' || color === '#000' || color === '#000000') {
            hexColor = 0x111111; // 黒
          } else if (color === 'win98blue' || color === '#0037A6') {
            hexColor = 0x0037A6; // Win98ブルー
          } else if (color === 'snap') {
            hexColor = 0x00AD50; // Snap色
          } else if (color.startsWith('#')) {
            // #で始まる色コードは最後に処理（上記の条件に該当しない場合）
            hexColor = parseInt(color.slice(1), 16);
          }
          
          (mesh.material as THREE.MeshBasicMaterial).color.setHex(hexColor);
        }
      };
      
      // 初期色を設定
      updateColor(frameColor);

      // Win98風カクカク回転（8fps, 1step=0.08rad）
      let theta = 0;
      const step = 0.1;
      const interval = 1000 / 10; // 10fps
      const intervalId = setInterval(() => {
        theta -= step; // マイナスにして時計回りに変更
        if (mesh) mesh.rotation.y = theta;
        renderer.render(scene, camera);
      }, interval);

      // クリーンアップ
      return () => {
        clearInterval(intervalId);
      };
    });

    // クリーンアップ
    return () => {
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        scene.remove(mesh);
      }
      renderer.dispose();
      while (mount.firstChild) mount.removeChild(mount.firstChild);
    };
  }, [frameColor]); // frameColorが変更されたら再レンダリング

  return <div ref={mountRef} style={{ width: 400, height: 120 }} />;
};

const FramesTool: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [space, setSpace] = useState<SpaceType>('M');
  const [ratio, setRatio] = useState<RatioType>('5:7');
  const [color, setColor] = useState<ColorType>('');
  const [autoColor, setAutoColor] = useState<string>('#e53e3e'); // デフォルトは赤
  const [snapPattern, setSnapPattern] = useState<1 | 2>(1); // Snap色のパターン管理
  const [autoPattern, setAutoPattern] = useState<1 | 2 | 3>(1); // auto色のパターン管理
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [captionLines, setCaptionLines] = useState<[string, string]>(['', '']);
  const [printStatus, setPrintStatus] = useState<'idle' | 'done'>('idle');
  const [controllerVisible, setControllerVisible] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  // 必要なrefやstateを復活
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [forceMobile, setForceMobile] = useState<null | boolean>(null);
  const [titlePosition, setTitlePosition] = useState(0);

  // スマホ用プレビューサイズ
  const maxMobileW = Math.floor(Math.min(window.innerWidth * 0.95, 340));
  const maxMobileH = 600;
  const [rw, rh] = ratio === '1:1' ? [1, 1] : ratio === '5:7' ? [5, 7] : [9, 16];
  let mobilePreviewW = maxMobileW;
  let mobilePreviewH = Math.round(mobilePreviewW * rh / rw);
  if (mobilePreviewH > maxMobileH) {
    mobilePreviewH = maxMobileH;
    mobilePreviewW = Math.round(mobilePreviewH * rw / rh);
  }

  let canvasW = mobilePreviewW;
  let canvasH = mobilePreviewH;
  if (!forceMobile) {
    const baseW = 480;
    const baseH = Math.round(baseW * 7 / 5); // 672
    if (ratio === '1:1') {
      canvasW = baseW;
      canvasH = baseW;
    } else if (ratio === '9:16') {
      canvasH = baseH;
      canvasW = Math.round(canvasH * 9 / 16);
    } else {
      // 5:7
      canvasW = baseW;
      canvasH = baseH;
    }
  }

  // JSXより前でpreviewWidthを定義
  let previewWidthNum = 75; // vw
  if (ratio === '9:16') previewWidthNum = 60;
  if (ratio === '1:1') previewWidthNum = 75;
  const previewWidth = `${previewWidthNum}vw`;
  const baseWidth = 75; // 5:7のvw
  const diff = (baseWidth - previewWidthNum) / 2;
  const controllerMarginLeft = diff > 0 ? `${diff}vw` : '0px';

  // アスペクト比チェック関数（3:4に近いかどうか）
  const isSupportedAspectRatio = useCallback((width: number, height: number): boolean => {
    const aspectRatio = width / height;
    const targetRatio = 3 / 4; // 3:4
    const tolerance = 0.1; // 10%の許容範囲
    return Math.abs(aspectRatio - targetRatio) < tolerance;
  }, []);

  // 主色抽出（簡易版: 全体平均）
  const getDominantColor = useCallback((img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#e53e3e';
    ctx.drawImage(img, 0, 0, 10, 10);
    const data = ctx.getImageData(0, 0, 10, 10).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2];
    }
    r = Math.round(r / 100); g = Math.round(g / 100); b = Math.round(b / 100);
    return `rgb(${r},${g},${b})`;
  }, []);

  // auto色のパターン2: 画像中央10%の平均色
  const getCenterAverageColor = useCallback((img: HTMLImageElement, percent: number = 0.1): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#e53e3e';
    const size = Math.floor(Math.min(img.width, img.height) * percent);
    const startX = Math.floor((img.width - size) / 2);
    const startY = Math.floor((img.height - size) / 2);
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, startX, startY, size, size, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0;
    const pixelCount = size * size;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);
    return `rgb(${r},${g},${b})`;
  }, []);

  // auto色のパターン3: 明るい有彩色の平均色
  const getHighlightColor = useCallback((img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#e53e3e';
    ctx.drawImage(img, 0, 0, 20, 20);
    const data = ctx.getImageData(0, 0, 20, 20).data;
    let colors: { r: number, g: number, b: number }[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      if (l > 0.4 && s > 0.4) {
        colors.push({ r, g, b });
      }
    }
    if (colors.length === 0) return '#e53e3e';
    const r = Math.round(colors.reduce((sum, c) => sum + c.r, 0) / colors.length);
    const g = Math.round(colors.reduce((sum, c) => sum + c.g, 0) / colors.length);
    const b = Math.round(colors.reduce((sum, c) => sum + c.b, 0) / colors.length);
    return `rgb(${r},${g},${b})`;
  }, []);

  // 画像アップロード
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        // アスペクト比チェック
        if (!isSupportedAspectRatio(img.width, img.height)) {
          setShowErrorPopup(true);
          return;
        }
        
        setImage(img);
        setAutoColor(getDominantColor(img));
        setAutoPattern(1); // auto色はパターン1から開始
        setColor('white');
        // Exif取得
        EXIF.getData(img as any, function(this: any) {
          const exif: ExifData = {
            Make: EXIF.getTag(this, 'Make'),
            Model: EXIF.getTag(this, 'Model'),
            ISO: EXIF.getTag(this, 'ISOSpeedRatings'),
            FNumber: EXIF.getTag(this, 'FNumber') ? Number(EXIF.getTag(this, 'FNumber').numerator / EXIF.getTag(this, 'FNumber').denominator) : undefined,
            ExposureTime: EXIF.getTag(this, 'ExposureTime') ? Number(EXIF.getTag(this, 'ExposureTime').numerator / EXIF.getTag(this, 'ExposureTime').denominator) : undefined,
          };
          setExifData(exif);
          setCaptionLines(getCaptionLines(exif));
        });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [getDominantColor, isSupportedAspectRatio]);

  // プレイスホルダークリックでファイル選択
  const handlePlaceholderClick = () => {
    fileInputRef.current?.click();
  };

  // auto色の切り替えロジック
  const handleColorChange = (newColor: ColorType) => {
    if (newColor === 'snap') {
      if (color === 'snap') {
        setSnapPattern(snapPattern === 1 ? 2 : 1);
      } else {
        setSnapPattern(1);
        setColor('snap');
      }
    } else if (newColor === 'auto') {
      setColor('auto');
      if (image) setAutoColor(getDominantColor(image));
      if (color === 'auto') {
        // auto色が既に選択されている場合、パターンを切り替え
        const nextPattern = autoPattern === 1 ? 2 : autoPattern === 2 ? 3 : 1;
        setAutoPattern(nextPattern);
        if (image) {
          if (nextPattern === 1) {
            setAutoColor(getDominantColor(image));
          } else if (nextPattern === 2) {
            setAutoColor(getCenterAverageColor(image));
          } else {
            setAutoColor(getHighlightColor(image));
          }
        }
      } else {
        // 他の色からauto色に切り替える場合、パターン1から開始
        setAutoPattern(1);
      }
    } else {
      setColor(newColor);
    }
  };

  // drawCanvas: プレースホルダーは常に静的な斜線＋マークのみ
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Retina対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!image) {
      // プレースホルダー: 背景＋2本斜線
      const frameColor = getFrameColor(color, autoColor, snapPattern);
      ctx.fillStyle = frameColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
      // 斜線1
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvasW, 0);
      ctx.lineTo(0, canvasH);
      ctx.stroke();
      // 斜線2
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(canvasW, canvasH);
      ctx.stroke();
      // ＋マークは初回アクセス時（colorが''）のみ表示
      if (color === '') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#111"; // 常に黒色で描画
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(canvasW / 2 - 13, canvasH / 2);
        ctx.lineTo(canvasW / 2 + 13, canvasH / 2);
        ctx.moveTo(canvasW / 2, canvasH / 2 - 13);
        ctx.lineTo(canvasW / 2, canvasH / 2 + 13);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      // 画像描画（従来通り）
      const frameColor = getFrameColor(color, autoColor, snapPattern);
      ctx.fillStyle = frameColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const { padTop, padLeft, padRight, padBottom } = getFramePadding(canvasW, canvasH, ratio, space);
      const drawW = canvasW - padLeft - padRight;
      const drawH = canvasH - padTop - padBottom;
      let imageDrawTop = padTop;
      let imageDrawHeight = drawH;
      const imgAspect = image.width / image.height;
      const frameAspect = drawW / drawH;
      let targetW, targetH;
      if (imgAspect > frameAspect) {
        targetW = drawW;
        targetH = drawW / imgAspect;
      } else {
        targetH = drawH;
        targetW = drawH * imgAspect;
      }
      const left = padLeft + (drawW - targetW) / 2;
      const top = padTop;
      imageDrawTop = top;
      imageDrawHeight = targetH;
      ctx.drawImage(image, left, top, targetW, targetH);
      if (captionLines[0] || captionLines[1]) {
        drawCaption(ctx, canvasW, canvasH, padBottom, imageDrawTop, imageDrawHeight, captionLines, frameColor, space, ratio, image?.width, image?.height);
      }
    }
  }, [image, space, ratio, color, autoColor, canvasW, canvasH, captionLines, snapPattern]);

  // 判定が終わるまで何も描画しない
  useEffect(() => {
    if (forceMobile === null) return;
    drawCanvas();
  }, [color, autoColor, snapPattern, image, ratio, space, canvasW, canvasH, forceMobile]);

  useEffect(() => {
    const handleResize = () => {
      const previewWidth = 480; // baseW
      const controllerWidth = 300; // md:w-[300px]
      const leftSpace = window.innerWidth - previewWidth - controllerWidth;
      setForceMobile(leftSpace < 340);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateTitlePosition = () => {
      const previewCenterX = window.innerWidth / 2;
      const idealTitleX = previewCenterX / 2;
      setTitlePosition(idealTitleX);
    };
    window.addEventListener('resize', updateTitlePosition);
    updateTitlePosition();
    return () => window.removeEventListener('resize', updateTitlePosition);
  }, []);

  useEffect(() => {
    // キャンバス描画が終わった直後にコントローラーを表示
    if (forceMobile !== null) {
      setControllerVisible(true);
    }
  }, [forceMobile, canvasW, canvasH]);

  const getPreviewWidthClass = (ratio: string) => {
    if (ratio === '1:1') return 'w-[60vw]';
    if (ratio === '5:7') return 'w-[55vw]';
    return 'w-[40vw]';
  };

  // スマホ用コントローラー幅（プレビューよりやや狭いくらい）
  const mobileControllerW = Math.max(mobilePreviewW * 0.85, 280);

  if (forceMobile) {
    // --- スマホ用レイアウト ---
    return (
      <div className="bg-[#F2F2F2] flex flex-col min-h-screen" style={{ padding: '0 12px' }}>
        <Win98ErrorPopup isVisible={showErrorPopup} onClose={() => setShowErrorPopup(false)} />
        {/* タイトル（画面左上） */}
        <span
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: '#111',
            fontFamily: 'KT Flux 2 100 SemiBold, sans-serif',
            marginTop: 16,
            marginLeft: `calc(50% - ${canvasW / 2}px)`,
            marginBottom: 0,
            letterSpacing: '0.01em',
            userSelect: 'none',
            flexShrink: 0,
            alignSelf: 'flex-start'
          }}
        >
          Frames
        </span>
        {/* キャンバス中央揃え */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div
            className="mb-8"
            style={{
              background: '#e5e5e5',
              boxShadow: '0 2px 12px #0001',
              borderRadius: 0,
              minWidth: 120,
              minHeight: 120,
              maxWidth: 340,
              maxHeight: 600,
              width: canvasW,
              height: canvasH,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center'
            }}
            onClick={() => { if (!image) handlePlaceholderClick(); }}
          >
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{
                width: canvasW,
                height: canvasH,
                maxWidth: 340,
                maxHeight: 600,
                position: 'static',
                margin: '0 auto'
              }}
            />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" style={{ display: 'none' }} />
          </div>
        </div>
        {/* コントローラー: キャンバスの下に配置し、上から下にスライドイン */}
        <div
          className="mt-0 transition-none"
          style={{ width: mobileControllerW, margin: "0 auto", boxSizing: "border-box", paddingLeft: "12px", paddingRight: "12px", transition: 'none' }}
        >
          <div className="flex flex-col gap-y-8 w-full">
            {/* Ratio */}
            <div className="flex flex-col items-start">
              <div className="text-left mb-0" style={{ fontSize: '0.95rem' }}>
                <span className="font-bold mr-2" style={{ letterSpacing: '0.1em' }}>Ratio :</span>
                <span style={{ letterSpacing: '0.1em' }}>{ratio}</span>
              </div>
              <div className="w-full">
                <SliderWithLabels
                  options={RATIOS}
                  value={ratio}
                  onChange={setRatio}
                  label=""
                  icons={[<RatioIcon ratio="1:1" />, <RatioIcon ratio="5:7" />, <RatioIcon ratio="9:16" />]}
                  iconPosition="above"
                  iconMargin={16}
                  trackMargin={0}
                  labelMarginLeft={0}
                  labelMarginBottom={4}
                  hideLabel={true}
                />
              </div>
            </div>
            {/* Spaces */}
            <div className="flex flex-col items-start">
              <div className="text-left mb-0 ml-1.5" style={{ fontSize: '0.95rem' }}>
                <span className="font-bold mr-2" style={{ letterSpacing: '0.1em' }}>Spaces :</span>
                <span style={{ letterSpacing: '0.1em' }}>{space}</span>
              </div>
              <div className="w-full">
                <SliderWithLabels
                  options={SPACES}
                  value={space}
                  onChange={setSpace}
                  label=""
                  iconPosition="none"
                  trackMargin={0}
                  labelMarginLeft={0}
                  labelMarginBottom={4}
                  hideLabel={true}
                />
              </div>
            </div>
            {/* Colour */}
            <div className="flex flex-col items-start">
              <div className="text-left mb-2" style={{ fontSize: '0.95rem' }}>
                <span className="font-bold" style={{ letterSpacing: '0.1em' }}>Colour :</span>
                <span className="ml-2" style={{ letterSpacing: '0.03em' }}>{COLOR_LABELS[color]}</span>
              </div>
              <div className="w-full">
                <div className="flex flex-row gap-2 p-1 bg-white border border-b-[2px] border-r-[2px] border-t border-l border-t-white border-l-white border-b-gray-500 border-r-gray-500 shadow w-full rounded-none">
                  {COLORS.map((c, i) => (
                    <button
                      key={c.key}
                      className={`flex-1 h-7 border-[1px] ${color === c.key ? 'border-black' : 'border-gray-400'} transition-all`}
                      style={{
                        background:
                          c.key === 'auto'
                            ? (image
                                ? autoColor
                                : 'linear-gradient(90deg, #e53e3e, #fbbf24, #34d399, #3b82f6, #a78bfa)')
                            : c.key === 'snap'
                            ? (color === 'snap' ? getFrameColor('snap', autoColor, snapPattern) : c.color)
                            : c.color
                      }}
                      onClick={() => handleColorChange(c.key as ColorType)}
                      aria-label={c.key}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* ボタン群 */}
          <div className="w-full flex justify-end gap-3 mt-8 max-w-[260px] mx-auto" style={{ marginBottom: 50 }}>
            <button
              className="px-4 py-1 bg-[#dfdfdf] border border-b-[3px] border-r-[3px] border-t border-l border-t-white border-l-white border-b-gray-400 border-r-gray-400 text-black text-sm font-normal shadow-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[80px] min-h-[28px] transition-none rounded-none"
              style={{ transition: 'none' }}
              onClick={() => {
                setImage(null);
                setColor('');
                setAutoColor('#e53e3e');
                setSnapPattern(1);
                setAutoPattern(1);
                setExifData(null);
                setCaptionLines(['', '']);
              }}
            >
              Cancel
            </button>
            <button
              className="px-4 py-1 bg-[#dfdfdf] border border-b-[3px] border-r-[3px] border-t border-l border-t-white border-l-white border-b-gray-700 border-r-gray-700 text-black text-sm font-normal shadow active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[80px] min-h-[28px] transition-none rounded-none"
              style={{ transition: 'none' }}
              onClick={() => {
                if (!canvasRef.current || !image) return;
                
                // 高解像度出力用のキャンバスを作成
                const outputCanvas = document.createElement('canvas');
                const outputCtx = outputCanvas.getContext('2d');
                if (!outputCtx) return;

                // === Ratioごとのアスペクト比設定 ===
                const ratioMap = {
                  '1:1': [1, 1],
                  '5:7': [5, 7],
                  '9:16': [9, 16],
                };
                const [rw, rh] = ratioMap[ratio as keyof typeof ratioMap] || [1, 1];

                // 出力用の長辺サイズ（3000px）
                const outputLong = OUTPUT_LONG_SIDE;
                const aspect = rh / rw;
                const outputW = rw >= rh ? outputLong : Math.round(outputLong * rw / rh);
                const outputH = rh > rw ? outputLong : Math.round(outputLong * rh / rw);

                // 出力キャンバスのサイズ設定
                outputCanvas.width = outputW;
                outputCanvas.height = outputH;

                // 背景色を設定
                const frameColorOut = getFrameColor(color, autoColor, snapPattern);
                outputCtx.fillStyle = frameColorOut;
                outputCtx.fillRect(0, 0, outputW, outputH);

                // 余白計算
                const { padTop: padTopOut, padLeft: padLeftOut, padRight: padRightOut, padBottom: padBottomOut } = getFramePadding(outputW, outputH, ratio, space);
                const drawWOut = outputW - padLeftOut - padRightOut;
                const drawHOut = outputH - padTopOut - padBottomOut;

                // 画像描画領域
                const imgAspect = image.width / image.height;
                const frameAspect = drawWOut / drawHOut;

                let targetW, targetH;
                if (imgAspect > frameAspect) {
                  targetW = drawWOut;
                  targetH = drawWOut / imgAspect;
                } else {
                  targetH = drawHOut;
                  targetW = drawHOut * imgAspect;
                }

                // 上詰め配置（padTopがそのまま上余白になる）
                const left = padLeftOut + (drawWOut - targetW) / 2;
                const top = padTopOut;

                // 画像を描画（クロップや拡大はしない）
                outputCtx.drawImage(image, left, top, targetW, targetH);

                // キャプション描画
                if (captionLines[0] || captionLines[1]) {
                  drawCaption(outputCtx, outputW, outputH, padBottomOut, top, targetH, captionLines, frameColorOut, space, ratio, image?.width, image?.height);
                }

                // ダウンロード
                outputCanvas.toBlob(async (blob) => {
                  if (!blob) return;
                  const ratioMap = { '1:1': 'sq', '5:7': 'x', '9:16': 'ig' };
                  const now = new Date();
                  const yyyy = now.getFullYear();
                  const mm = String(now.getMonth() + 1).padStart(2, '0');
                  const dd = String(now.getDate()).padStart(2, '0');
                  const hh = String(now.getHours()).padStart(2, '0');
                  const min = String(now.getMinutes()).padStart(2, '0');
                  const ratioShort = ratioMap[ratio] || 'x';
                  const filename = `frames-${yyyy}-${mm}${dd}-${hh}${min}-${ratioShort}.jpeg`;

                  // Fileオブジェクトを先に作る
                  const file = new File([blob], filename, { type: 'image/jpeg' });

                  // スマホ＆Web Share API（files対応）判定
                  if (
                    isMobileDevice() &&
                    navigator.canShare &&
                    navigator.canShare({ files: [file] })
                  ) {
                    try {
                      await navigator.share({
                        files: [file],
                        title: 'Frames Photo',
                        text: 'Check out this photo frame!',
                      });
                      // 共有成功時は何もしない
                      setPrintStatus('done');
                      setTimeout(() => {
                        setPrintStatus('idle');
                        setImage(null);
                        setColor('');
                        setAutoColor('#e53e3e');
                        setSnapPattern(1);
                        setAutoPattern(1);
                        setExifData(null);
                        setCaptionLines(['', '']);
                      }, 1500);
                      return;
                    } catch (err) {
                      // 共有キャンセルやエラー時はダウンロードにフォールバック
                    }
                  }

                  // ダウンロード処理（PCや非対応端末、共有失敗時）
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  setPrintStatus('done');
                  setTimeout(() => {
                    setPrintStatus('idle');
                    setImage(null);
                    setColor('');
                    setAutoColor('#e53e3e');
                    setSnapPattern(1);
                    setAutoPattern(1);
                    setExifData(null);
                    setCaptionLines(['', '']);
                  }, 1500);
                }, 'image/jpeg', 1.0);
              }}
            >
              {printStatus === 'done' ? 'Done!' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PC用レイアウト ---
  return (
    <div className="bg-[#F2F2F2] flex flex-row min-h-screen">
      <Win98ErrorPopup isVisible={showErrorPopup} onClose={() => setShowErrorPopup(false)} />
      {/* タイトルカラム: 画面Y軸中央に配置 */}
      <div className="flex justify-center items-center w-[320px] h-screen">
        <Frames3DTitle frameColor={(!image && color === '') ? '#111' : getFrameColor(color, autoColor, snapPattern)} />
      </div>
      {/* プレビュー＋コントローラー: 固定レイアウト */}
      <div className="flex-1 flex flex-row items-center" style={{ minHeight: '100vh' }}>
        <div className="flex flex-row items-center" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
          {/* プレビューラッパー: 固定位置 */}
          <div style={{ width: '480px', display: 'flex', justifyContent: 'center' }}>
            <div
              className="relative flex justify-center items-center"
              style={{ maxWidth: `${canvasW}px`, maxHeight: `${canvasH}px`, minWidth: 200, minHeight: 280, cursor: image ? 'default' : 'pointer' }}
              onClick={() => { if (!image) handlePlaceholderClick(); }}
            >
              <canvas
                ref={canvasRef}
                width={canvasW}
                height={canvasH}
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', boxShadow: '0 2px 12px #0001' }}
              />

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" style={{ display: 'none' }} />
            </div>
          </div>
          {/* コントローラー: 固定位置、60px間隔 */}
          <motion.div 
            className="w-[225px] flex flex-col items-start" 
            style={{ marginLeft: '60px' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex flex-col gap-y-8 w-full">
              {/* Ratio */}
              <div className="flex flex-col items-start">
                <div className="text-left mb-0" style={{ fontSize: '1.05rem', paddingLeft: LABEL_OFFSETS.ratio }}>
                  <span className="font-bold mr-2" style={{ letterSpacing: '0.03em' }}>Ratio :</span>
                  <span style={{ letterSpacing: '0.1em' }}>{ratio}</span>
                </div>
                <div className="flex justify-start w-full">
                  <SliderWithLabels
                    options={RATIOS}
                    value={ratio}
                    onChange={setRatio}
                    label=""
                    icons={[<RatioIcon ratio="1:1" />, <RatioIcon ratio="5:7" />, <RatioIcon ratio="9:16" />]}
                    iconPosition="above"
                    iconMargin={16}
                    trackMargin={0}
                    labelMarginLeft={0}
                    labelMarginBottom={4}
                    hideLabel={true}
                  />
                </div>
              </div>
              {/* Spaces */}
              <div className="flex flex-col items-start">
                <div className="text-left mb-0 ml-1.5" style={{ fontSize: '1.05rem', paddingLeft: LABEL_OFFSETS.spaces }}>
                  <span className="font-bold mr-2" style={{ letterSpacing: '0.015em' }}>Spaces :</span>
                  <span style={{ letterSpacing: '0.1em' }}>{space}</span>
                </div>
                <div className="flex justify-start w-full">
                  <SliderWithLabels
                    options={SPACES}
                    value={space}
                    onChange={setSpace}
                    label=""
                    iconPosition="none"
                    trackMargin={0}
                    labelMarginLeft={0}
                    labelMarginBottom={4}
                    hideLabel={true}
                  />
                </div>
              </div>
              {/* Colour */}
              <div className="flex flex-col items-start">
                <div className="text-left mb-2" style={{ fontSize: '1.05rem', paddingLeft: LABEL_OFFSETS.colour }}>
                  <span className="font-bold" style={{ letterSpacing: '0.01em' }}>Colour :</span>
                  <span className="ml-2" style={{ letterSpacing: '0.03em' }}>{COLOR_LABELS[color]}</span>
                </div>
                <div className="flex justify-start w-full">
                  <div className="flex flex-row gap-2 p-1 bg-white border border-b-[2px] border-r-[2px] border-t border-l border-t-white border-l-white border-b-gray-500 border-r-gray-500 shadow w-full rounded-none">
                    {COLORS.map((c, i) => (
                      <button
                        key={c.key}
                        className={`flex-1 h-7 border-[1px] ${color === c.key ? 'border-black' : 'border-gray-400'} transition-all`}
                        style={{
                          background:
                            c.key === 'auto'
                              ? (image
                                  ? autoColor
                                  : 'linear-gradient(90deg, #e53e3e, #fbbf24, #34d399, #3b82f6, #a78bfa)')
                              : c.key === 'snap'
                              ? (color === 'snap' ? getFrameColor('snap', autoColor, snapPattern) : c.color)
                              : c.color
                        }}
                        onClick={() => handleColorChange(c.key as ColorType)}
                        aria-label={c.key}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Printボタン（編集項目群の下、セクション間マージン） */}
            <div className="w-full flex justify-end gap-3 mt-12">
              <button
                className="px-4 py-1 bg-[#dfdfdf] border border-b-[3px] border-r-[3px] border-t border-l border-t-white border-l-white border-b-gray-400 border-r-gray-400 text-black text-sm font-normal shadow-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[80px] min-h-[28px] transition-none rounded-none"
                style={{ transition: 'none' }}
                onClick={() => {
                  setImage(null);
                  setColor('');
                  setAutoColor('#e53e3e');
                  setSnapPattern(1);
                  setAutoPattern(1);
                  setExifData(null);
                  setCaptionLines(['', '']);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1 bg-[#dfdfdf] border border-b-[3px] border-r-[3px] border-t border-l border-t-white border-l-white border-b-gray-700 border-r-gray-700 text-black text-sm font-normal shadow active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[80px] min-h-[28px] transition-none rounded-none"
                style={{ transition: 'none' }}
                onClick={() => {
                  if (!canvasRef.current || !image) return;
                  
                  // 高解像度出力用のキャンバスを作成
                  const outputCanvas = document.createElement('canvas');
                  const outputCtx = outputCanvas.getContext('2d');
                  if (!outputCtx) return;

                  // === Ratioごとのアスペクト比設定 ===
                  const ratioMap = {
                    '1:1': [1, 1],
                    '5:7': [5, 7],
                    '9:16': [9, 16],
                  };
                  const [rw, rh] = ratioMap[ratio as keyof typeof ratioMap] || [1, 1];

                  // 出力用の長辺サイズ（3000px）
                  const outputLong = OUTPUT_LONG_SIDE;
                  const aspect = rh / rw;
                  const outputW = rw >= rh ? outputLong : Math.round(outputLong * rw / rh);
                  const outputH = rh > rw ? outputLong : Math.round(outputLong * rh / rw);

                  // 出力キャンバスのサイズ設定
                  outputCanvas.width = outputW;
                  outputCanvas.height = outputH;

                  // 背景色を設定
                  const frameColorOut = getFrameColor(color, autoColor, snapPattern);
                  outputCtx.fillStyle = frameColorOut;
                  outputCtx.fillRect(0, 0, outputW, outputH);

                  // 余白計算
                  const { padTop: padTopOut, padLeft: padLeftOut, padRight: padRightOut, padBottom: padBottomOut } = getFramePadding(outputW, outputH, ratio, space);
                  const drawWOut = outputW - padLeftOut - padRightOut;
                  const drawHOut = outputH - padTopOut - padBottomOut;

                  // 画像描画領域
                  const imgAspect = image.width / image.height;
                  const frameAspect = drawWOut / drawHOut;

                  let targetW, targetH;
                  if (imgAspect > frameAspect) {
                    targetW = drawWOut;
                    targetH = drawWOut / imgAspect;
                  } else {
                    targetH = drawHOut;
                    targetW = drawHOut * imgAspect;
                  }

                  // 上詰め配置（padTopがそのまま上余白になる）
                  const left = padLeftOut + (drawWOut - targetW) / 2;
                  const top = padTopOut;

                  // 画像を描画（クロップや拡大はしない）
                  outputCtx.drawImage(image, left, top, targetW, targetH);

                  // キャプション描画
                  if (captionLines[0] || captionLines[1]) {
                    drawCaption(outputCtx, outputW, outputH, padBottomOut, top, targetH, captionLines, frameColorOut, space, ratio, image?.width, image?.height);
                  }

                  // ダウンロード
                  outputCanvas.toBlob(async (blob) => {
                    if (!blob) return;
                    const ratioMap = { '1:1': 'sq', '5:7': 'x', '9:16': 'ig' };
                    const now = new Date();
                    const yyyy = now.getFullYear();
                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                    const dd = String(now.getDate()).padStart(2, '0');
                    const hh = String(now.getHours()).padStart(2, '0');
                    const min = String(now.getMinutes()).padStart(2, '0');
                    const ratioShort = ratioMap[ratio] || 'x';
                    const filename = `frames-${yyyy}-${mm}${dd}-${hh}${min}-${ratioShort}.jpeg`;

                    // Fileオブジェクトを先に作る
                    const file = new File([blob], filename, { type: 'image/jpeg' });

                    // スマホ＆Web Share API（files対応）判定
                    if (
                      isMobileDevice() &&
                      navigator.canShare &&
                      navigator.canShare({ files: [file] })
                    ) {
                      try {
                        await navigator.share({
                          files: [file],
                          title: 'Frames Photo',
                          text: 'Check out this photo frame!',
                        });
                        // 共有成功時は何もしない
                        setPrintStatus('done');
                        setTimeout(() => {
                          setPrintStatus('idle');
                          setImage(null);
                          setColor('');
                          setAutoColor('#e53e3e');
                          setSnapPattern(1);
                          setAutoPattern(1);
                          setExifData(null);
                          setCaptionLines(['', '']);
                        }, 1500);
                        return;
                      } catch (err) {
                        // 共有キャンセルやエラー時はダウンロードにフォールバック
                      }
                    }

                    // ダウンロード処理（PCや非対応端末、共有失敗時）
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    setPrintStatus('done');
                    setTimeout(() => {
                      setPrintStatus('idle');
                      setImage(null);
                      setColor('');
                      setAutoColor('#e53e3e');
                      setSnapPattern(1);
                      setAutoPattern(1);
                      setExifData(null);
                      setCaptionLines(['', '']);
                    }, 1500);
                  }, 'image/jpeg', 1.0);
                }}
              >
                {printStatus === 'done' ? 'Done!' : 'Print'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FramesTool;
