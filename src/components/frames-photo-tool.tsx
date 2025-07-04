import React, { useRef, useState, useCallback, useEffect } from 'react';
import EXIF from 'exif-js';
import { getCaptionLines, ExifData } from '../utils/caption';
import { getCaptionYOffset, getCaptionYPosition, isSupportedAspectRatio } from '../utils/caption-position';
import { isFilmScanner, isFilmScanExif } from '../utils/film-scanner';
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
  { key: 'retroblue', color: '#0037A6' }, // Retroブルースクリーン
  { key: 'snap', color: '#00AD50' },      // Snap
  { key: 'auto', color: '' }, // 主色は後でセット
];

// Snap色の2つのパターン
const SNAP_COLORS = {
  pattern1: '#00AD50', // 元のSnap色
  pattern2: '#FF9900', // オレンジ系のSnap色
} as const;

// BSoD色の2つのパターン
const RETROBLUE_COLORS = {
  pattern1: '#0037A6', // 元のRetroブルー
  pattern2: '#008080', // Emerald
} as const;

// ラベルの左オフセット
const LABEL_OFFSETS_PC = {
  ratio: 4,
  spaces: -6, // 10px左に移動
  colour: 3
} as const;
const LABEL_OFFSETS_SP = {
  ratio: 5,
  spaces: 6,
  colour: 3
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
        {/* 横線バー（Retro風：上が白、下がグレー） */}
        <div className="absolute left-[11px] right-[11px] z-0" style={{ height: 2, top: 'calc(50% - 1px)' }}>
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
            className="slider-thumb-retro"
            style={{
              position: 'absolute',
              top: 'calc(50% - 1px)',
              transform: 'translateY(-60%)',
              left: `1px`,
              width: `calc(100% - 2px)`,
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

// 機能フラグ: ドラッグ可能パネルの有効/無効
const ENABLE_DRAGGABLE_PANEL = true; // falseにすると固定パネルに戻る

// Ratio → Spaces の順
const minPadBottomTable: Record<string, Record<string, number>> = {
  '1:1': { S: 0.17, M: 0.17, L: 0.17 },
  '5:7': { S: 0.1, M: 0.17, L: 0.17 },
  '9:16': { S: 0.17, M: 0.17, L: 0.17 },
};



// Colour名ラベル
const COLOR_LABELS: Record<ColorType, string> = {
  white: 'White',
  black: 'Dark',
  retroblue: 'BSoD',
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
  font1: 0.023,    // 出力画像の短辺の2.5%
  font2: 0.019,  // 出力画像の短辺の2%
  lineGap: 0.007, // 出力画像の短辺の1%
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
  const yStart = getCaptionYPosition({
    ratio,
    space,
    canvasHeight: height,
    padBottom,
    imageDrawTop,
    imageDrawHeight,
    captionHeight: totalHeight,
    imageWidth,
    imageHeight
  });
  
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
  const letterSpacing1 = 0.4; // 1行目（Shot on/機種名）- 字間を広げる
  const letterSpacing2 = 0.4; // 2行目
  
  // 1行目は不透明で描画
  ctx.globalAlpha = 1.0;
  if (captionLines[0]) {
    const shotOn = 'Shot on ';
    const cameraName = captionLines[0].replace(shotOn, '');
    
    // "Shot on"はKT Flux 100 Regularで描画
    ctx.font = `400 ${baseFontPx1}px 'KT Flux 100', Arial`;
    const shotOnWidth = ctx.measureText(shotOn).width + (shotOn.length - 1) * letterSpacing1;
    
    // 機種名はKT Flux 100 Mediumで描画
    ctx.font = `500 ${baseFontPx1}px 'KT Flux 100', Arial`;
    const cameraWidth = ctx.measureText(cameraName).width + (cameraName.length - 1) * letterSpacing1;
    
    const totalWidth = shotOnWidth + cameraWidth;
    const xStart = width / 2 - totalWidth / 2;
    
    // "Shot on"をKT Flux 100 Regularで描画
    ctx.font = `400 ${baseFontPx1}px 'KT Flux 100', Arial`;
    ctx.fillStyle = firstLineColor;
    drawTextWithLetterSpacing(ctx, shotOn, xStart, yStart, letterSpacing1);
    
    // 機種名をKT Flux 100 Mediumで描画
    ctx.font = `500 ${baseFontPx1}px 'KT Flux 100', Arial`;
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
  let padTop = Math.round(shortSide * basePadding);
  const padLeft = Math.round(shortSide * basePadding);
  const padRight = Math.round(shortSide * basePadding);
  // 下部は均等フレーム＋追加余白
  const padBottom = Math.round(shortSide * (basePadding + extraBottom));

  // 9:16（16:9）だけ上部余白を2.5倍に
  if (ratio === '9:16') {
    padTop = padTop * 2.5;
    // 9:16のSサイズの場合はさらに上部余白を増やす
    if (space === 'S') {
      padTop = padTop * 1.8; // 2.5倍のさらに1.8倍 = 4.5倍
    }
  }

  return { padTop, padLeft, padRight, padBottom };
}

// 先頭付近に追加
function getFrameColor(color: string, autoColor: string, snapPattern: 1 | 2 = 1, retrobluePattern: 1 | 2 = 1) {
  if (!color) return '#dfdfdf';
  if (color === 'white') return '#fff';
  if (color === 'black') return '#111';
  if (color === 'retroblue') return retrobluePattern === 1 ? RETROBLUE_COLORS.pattern1 : RETROBLUE_COLORS.pattern2;
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
  
// Retro風エラーポップアップコンポーネント
const RetroErrorPopup: React.FC<{ isVisible: boolean; onClose: () => void }> = ({ isVisible, onClose }) => {
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
              Support : 2:3, 3:4, 4:5, 5:7 ratio photos
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
interface Frames3DTitleProps {
  frameColor: string;
  colorKey?: string;
  snapPattern?: 1 | 2;
  retrobluePattern?: 1 | 2;
}
const Frames3DTitle: React.FC<Frames3DTitleProps> = ({ frameColor, colorKey, snapPattern = 1, retrobluePattern = 1 }) => {
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
      const updateColor = (color: string, colorKey?: string, snapPattern: 1|2 = 1, retrobluePattern: 1|2 = 1) => {
        if (mesh && mesh.material) {
          let hexColor = 0x111111; // デフォルトは黒
          if (colorKey === 'snap') {
            hexColor = snapPattern === 1 ? 0x00AD50 : 0xFF9900;
          } else if (colorKey === 'retroblue') {
            hexColor = retrobluePattern === 1 ? 0x0037A6 : 0x008080;
          } else if (color === 'white' || color === '#fff' || color === '#ffffff') {
            hexColor = 0x111111;
          } else if (color === 'black' || color === '#111' || color === '#000' || color === '#000000') {
            hexColor = 0x111111;
          } else if (color.startsWith('#')) {
            hexColor = parseInt(color.slice(1), 16);
          }
          (mesh.material as THREE.MeshBasicMaterial).color.setHex(hexColor);
        }
      };
      
      // 初期色を設定
      updateColor(frameColor, colorKey, snapPattern, retrobluePattern);

      // Retro風カクカク回転（8fps, 1step=0.08rad）
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
  }, [frameColor, colorKey, snapPattern, retrobluePattern]); // すべて変更で再レンダリング

  return <div ref={mountRef} style={{ width: 400, height: 120 }} />;
};

// Retro風ボタンの共通コンポーネント
const RetroButton: React.FC<{
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'cancel';
}> = ({ disabled, onClick, children, type = 'button', variant }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`retro-btn ${variant === 'primary' ? 'retro-btn-primary' : ''} ${variant === 'cancel' ? 'retro-btn-cancel' : ''}`}
    style={{ userSelect: 'none' }}
  >
    {children}
  </button>
);

const FramesTool: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [space, setSpace] = useState<SpaceType>('M');
  const [ratio, setRatio] = useState<RatioType>('5:7');
  const [color, setColor] = useState<ColorType>('');
  const [autoColor, setAutoColor] = useState<string>('#e53e3e'); // デフォルトは赤
  const [snapPattern, setSnapPattern] = useState<1 | 2>(1); // Snap色のパターン管理
  const [retrobluePattern, setRetrobluePattern] = useState<1 | 2>(1); // BSoD色のパターン管理
  const [autoPattern, setAutoPattern] = useState<1 | 2 | 3>(1); // auto色のパターン管理
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [captionLines, setCaptionLines] = useState<[string, string]>(['', '']);
  const [printStatus, setPrintStatus] = useState<'idle' | 'done'>('idle');
  const [showResetButton, setShowResetButton] = useState(false);
  const [controllerVisible, setControllerVisible] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [isPrintDisabled, setIsPrintDisabled] = useState(false);
  const [isFilmScannerImage, setIsFilmScannerImage] = useState(false); // フィルムスキャナー画像の判定結果

  // ドラッグ機能用のstate
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 }); // 初期値は0,0（後で計算で設定）
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanelInitialized, setIsPanelInitialized] = useState(false);

  // 必要なrefやstateを復活
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [forceMobile, setForceMobile] = useState<null | boolean>(null);
  const [titlePosition, setTitlePosition] = useState(0);

  // スマホ用プレビューサイズ
  const maxMobileW = Math.floor(Math.min(window.innerWidth * 0.80, 300)); // 85% → 80%、320 → 300
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

  // 画像ファイルをFileListで受け取って処理する関数
  const handleFilesUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        if (!isSupportedAspectRatio(img.width, img.height)) {
          setShowErrorPopup(true);
          return;
        }
        setImage(img);
        setAutoColor(getDominantColor(img));
        setAutoPattern(1);
        if (!color) {
          setColor('white');
        }
        EXIF.getData(img as any, function(this: any) {
          const exif: ExifData = {
            Make: EXIF.getTag(this, 'Make'),
            Model: EXIF.getTag(this, 'Model'),
            ISO: EXIF.getTag(this, 'ISOSpeedRatings'),
            FNumber: EXIF.getTag(this, 'FNumber') ? Number(EXIF.getTag(this, 'FNumber').numerator / EXIF.getTag(this, 'FNumber').denominator) : undefined,
            ExposureTime: EXIF.getTag(this, 'ExposureTime') ? Number(EXIF.getTag(this, 'ExposureTime').numerator / EXIF.getTag(this, 'ExposureTime').denominator) : undefined,
            Software: EXIF.getTag(this, 'Software'), // 追加: Softwareフィールド
          };
          setExifData(exif);
          
          // フィルムスキャン画像の判定（MakeまたはSoftware）
          const isFilmScannerDetected = isFilmScanExif(exif.Make, exif.Software);
          setIsFilmScannerImage(isFilmScannerDetected);
          
          // フィルムスキャナーまたはNegative Lab Proの場合は手動入力モードを有効化
          if (isFilmScannerDetected) {
            setManualCamera('');
            setManualPlace('');
            setCaptionLines(['', '']);
          } else {
            setCaptionLines(getCaptionLines(exif));
          }
        });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [getDominantColor, color]);

  // input[type=file]用
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesUpload(e.target.files);
  }, [handleFilesUpload]);

  // プレイスホルダークリックでファイル選択
  const handlePlaceholderClick = () => {
    fileInputRef.current?.click();
  };

  // ドラッグ開始処理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (forceMobile || !ENABLE_DRAGGABLE_PANEL) return; // モバイルまたはドラッグ無効時は無効
    
    // スライダーやボタンなどの操作要素からのドラッグは無効
    const target = e.target as HTMLElement;
    if (target.closest('input[type="range"]') || 
        target.closest('button') || 
        target.closest('.slider-thumb-retro')) {
      return;
    }
    
    // パネル全体の位置を基準にしたオフセット計算
    setOffset({
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y
    });
    setDragging(true);
    e.preventDefault();
  };

  // ドラッグ中処理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || forceMobile || !ENABLE_DRAGGABLE_PANEL) return;

    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;
    
    // 画面内制限（パネルサイズ: 260x300程度を想定）
    const maxX = window.innerWidth - 280;
    const maxY = window.innerHeight - 320;
    
    setPanelPos({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [dragging, offset, forceMobile]);

  // ドラッグ終了処理
  const handleMouseUp = useCallback(() => {
    if (!ENABLE_DRAGGABLE_PANEL) return;
    setDragging(false);
  }, []);

  // マウスイベントのリスナー設定
  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // auto色の切り替えロジック
  const handleColorChange = (newColor: ColorType) => {
    // 設定変更時にPrintボタンを有効化
    if (isPrintDisabled) {
      setIsPrintDisabled(false);
      setPrintStatus('idle');
    }
    
    if (newColor === 'retroblue') {
      if (color === 'retroblue') {
        setRetrobluePattern(retrobluePattern === 1 ? 2 : 1);
      } else {
        setRetrobluePattern(1);
        setColor('retroblue');
      }
    } else if (newColor === 'snap') {
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
      // プレースホルダー: 背景＋2本斜線＋枠線
      const frameColor = getFrameColor(color, autoColor, snapPattern, retrobluePattern);
      ctx.fillStyle = frameColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
      
      // 枠線を描画（画像がない時のみ）
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvasW, canvasH);
      
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
    } else {
      // 画像描画（従来通り）
      const frameColor = getFrameColor(color, autoColor, snapPattern, retrobluePattern);
      ctx.fillStyle = frameColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
      const { padTop, padLeft, padRight, padBottom } = getFramePadding(canvasW, canvasH, ratio, space);
      const drawW = canvasW - padLeft - padRight;
      const drawH = canvasH - padTop - padBottom;
      // Ratio 9:16 かつ Spaces L のときは padTop/padBottom を0、drawHをcanvasHにして中央揃え
      let padTopForDraw = padTop;
      let padBottomForDraw = padBottom;
      let drawHForDraw = drawH;
      if (ratio === '9:16' && space === 'L') {
        padTopForDraw = 0;
        padBottomForDraw = 0;
        drawHForDraw = canvasH;
      }
      let imageDrawTop, imageDrawHeight;
      const imgAspect = image.width / image.height;
      const frameAspect = drawW / drawHForDraw;
      let targetW, targetH;
      if (imgAspect > frameAspect) {
        targetW = drawW;
        targetH = drawW / imgAspect;
      } else {
        targetH = drawHForDraw;
        targetW = drawHForDraw * imgAspect;
      }
      const left = padLeft + (drawW - targetW) / 2;
      // Ratio 9:16の場合はどのSpacesでも中央配置、3:4画像かつRatio 5:7かつSpaces Lのときも中央配置
      const is34Image = Math.abs(image.width / image.height - 3 / 4) < 0.05;
      const is45Image = Math.abs(image.width / image.height - 4 / 5) < 0.05;
      let top;
      if (ratio === '9:16' || (is34Image && ratio === '5:7' && space === 'L') || (is45Image && ratio === '5:7' && space === 'L')) {
        top = padTopForDraw + (drawHForDraw - targetH) / 2;
      } else {
        top = padTopForDraw;
      }
      imageDrawTop = top;
      imageDrawHeight = targetH;
      ctx.drawImage(image, left, top, targetW, targetH);
      if (captionLines[0] || captionLines[1]) {
        drawCaption(ctx, canvasW, canvasH, padBottom, imageDrawTop, imageDrawHeight, captionLines, frameColor, space, ratio, image?.width, image?.height);
      }
    }
  }, [image, space, ratio, color, autoColor, canvasW, canvasH, captionLines, snapPattern, retrobluePattern]);

  // 判定が終わるまで何も描画しない
  useEffect(() => {
    drawCanvas();
  }, [image, space, ratio, color, autoColor, canvasW, canvasH, captionLines, snapPattern, retrobluePattern]);

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

  // ドラッグ機能のイベントリスナー（ドラッグ可能パネルが有効な場合のみ）
  useEffect(() => {
    if (!ENABLE_DRAGGABLE_PANEL) return;
    
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  // パネルの初期位置をキャンバスの右側に自動配置（初回のみ）
  useEffect(() => {
    if (!ENABLE_DRAGGABLE_PANEL || forceMobile || isPanelInitialized) return;
    
    // 画面サイズが確定してから位置を計算
    const calculateInitialPosition = () => {
      // キャンバス中央座標
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      // パネルサイズ
      const panelWidth = 260;
      const panelHeight = 360; // おおよその高さ
      // 余白
      const gap = 70;
      // 新しいパネル位置
      const x = centerX + canvasW / 2 + gap;
      const y = centerY - panelHeight / 2;
      setPanelPos({ x, y });
      setIsPanelInitialized(true);
    };
    
    // 即座に実行
    calculateInitialPosition();
  }, [canvasW, canvasH, forceMobile, isPanelInitialized]);

  // ウィンドウリサイズ時にコンパネの位置を調整
  useEffect(() => {
    if (!ENABLE_DRAGGABLE_PANEL || forceMobile || dragging) return;
    

    
    const handlePanelResize = () => {
      // パネルサイズ
      const panelWidth = 260;
      const panelHeight = 360;
      
      // 理想的な位置（キャンバスの右側70px）
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const gap = 70;
      const idealX = centerX + canvasW / 2 + gap;
      const idealY = centerY - panelHeight / 2;
      
      // 画面内制限
      const maxX = window.innerWidth - panelWidth - 20; // 右端から20px余裕
      const maxY = window.innerHeight - panelHeight - 20; // 下端から20px余裕
      const minX = 20; // 左端から20px余裕
      const minY = 20; // 上端から20px余裕
      
      let newX = panelPos.x;
      let newY = panelPos.y;
      let needsUpdate = false;
      let isEmergencyUpdate = false; // 緊急更新フラグ
      
      // 画面外に出そうになった場合：即座に反応
      if (panelPos.x > maxX || panelPos.x < minX || panelPos.y > maxY || panelPos.y < minY) {
        if (panelPos.x > maxX) {
          newX = maxX;
          needsUpdate = true;
          isEmergencyUpdate = true;
        }
        if (panelPos.x < minX) {
          newX = minX;
          needsUpdate = true;
          isEmergencyUpdate = true;
        }
        if (panelPos.y > maxY) {
          newY = maxY;
          needsUpdate = true;
          isEmergencyUpdate = true;
        }
        if (panelPos.y < minY) {
          newY = minY;
          needsUpdate = true;
          isEmergencyUpdate = true;
        }
      } else if (idealX <= maxX && idealY >= minY && idealY <= maxY) {
        // 画面を広くした場合：理想的な位置に戻す（即座に実行）
        if (Math.abs(panelPos.x - idealX) > 10 || Math.abs(panelPos.y - idealY) > 10) {
          newX = idealX;
          newY = idealY;
          needsUpdate = true;
          isEmergencyUpdate = true; // 理想的な位置に戻す場合も即座に実行
        }
      }
      
      // 位置調整が必要な場合のみ更新
      if (needsUpdate) {
        // すべて即座に実行（ラグを完全に解消）
        setPanelPos({ x: newX, y: newY });
      }
    };
    
    window.addEventListener('resize', handlePanelResize);
    return () => {
      window.removeEventListener('resize', handlePanelResize);
    };
  }, [ENABLE_DRAGGABLE_PANEL, forceMobile, dragging, panelPos, canvasW, canvasH]);

  const getPreviewWidthClass = (ratio: string) => {
    if (ratio === '1:1') return 'w-[60vw]';
    if (ratio === '5:7') return 'w-[55vw]';
    return 'w-[40vw]';
  };

  // スマホ用コントローラー幅（プレビューよりやや狭いくらい）
  const mobileControllerW = Math.max(mobilePreviewW * 0.85, 280);

  // 1. state追加
  const [manualCamera, setManualCamera] = useState('');
  const [manualPlace, setManualPlace] = useState('');
  const isManualMode = isFilmScannerImage; // フィルムスキャナー画像の場合のみ手入力

  // 2. 手入力時はcaptionLinesを手動で更新
  useEffect(() => {
    if (isManualMode) {
      setCaptionLines([
        manualCamera ? `Shot on ${manualCamera}` : '',
        manualPlace || ''
      ]);
    }
  }, [manualCamera, manualPlace, isManualMode]);

  if (forceMobile) {
    // --- スマホ用レイアウト ---
    return (
      <div className="bg-[#F2F2F2] flex flex-col min-h-screen" style={{ padding: '0 12px' }}>
        <RetroErrorPopup isVisible={showErrorPopup} onClose={() => setShowErrorPopup(false)} />
        {/* タイトル（画面左上） */}
        <span
          style={{
            fontSize: '0.9rem',
            fontWeight: 300,
            color: '#111',
            fontFamily: 'KT Flux 2 100 Light, sans-serif',
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
        {/* Retro風コントローラーパネル: キャンバスの下に移動 */}
        <div
          className="retro-panel"
          style={{
            background: '#c0c0c0',
            borderTop: '2px solid #fff',
            borderLeft: '2px solid #fff',
            borderBottom: '2px solid #808080',
            borderRight: '2px solid #808080',
            borderRadius: 0,
            padding: '12px 12px 10px 12px',
            width: 260,
            margin: '12px auto 36px auto', // 16px → 12px、下マージン16px → 36px
            boxSizing: 'border-box',
            boxShadow: '1px 1px 0 #000',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Ratio */}
            <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Ratio</div>
            <div style={{ marginBottom: 10 }}>
              <SliderWithLabels
                options={RATIOS}
                value={ratio}
                onChange={(newRatio) => {
                  if (isPrintDisabled) {
                    setIsPrintDisabled(false);
                    setPrintStatus('idle');
                  }
                  setRatio(newRatio);
                }}
                label=""
                icons={[<RatioIcon ratio="1:1" />, <RatioIcon ratio="5:7" />, <RatioIcon ratio="9:16" />]}
                iconPosition="above"
                iconMargin={8}
                trackMargin={0}
                labelMarginLeft={0}
                labelMarginBottom={2}
                hideLabel={true}
              />
            </div>
            {/* Spaces */}
            <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Spaces</div>
            <div style={{ marginBottom: 10 }}>
              <SliderWithLabels
                options={SPACES}
                value={space}
                onChange={(newSpace) => {
                  if (isPrintDisabled) {
                    setIsPrintDisabled(false);
                    setPrintStatus('idle');
                  }
                  setSpace(newSpace);
                }}
                label=""
                iconPosition="none"
                trackMargin={0}
                labelMarginLeft={0}
                labelMarginBottom={2}
                hideLabel={true}
              />
            </div>
            {/* Colour */}
            <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Colour</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 4, marginBottom: 20 }}>
              {COLORS.map((c, i) => (
                <button
                  key={c.key}
                  className="flex-1 h-6 border-[1px] select-none"
                  style={{
                    background:
                      c.key === 'auto'
                        ? (image
                            ? autoColor
                            : 'linear-gradient(90deg, #e53e3e, #fbbf24, #34d399, #3b82f6, #a78bfa)')
                        : c.key === 'snap'
                        ? (color === 'snap' ? getFrameColor('snap', autoColor, snapPattern) : c.color)
                        : c.key === 'retroblue'
                        ? (color === 'retroblue' ? getFrameColor('retroblue', autoColor, snapPattern, retrobluePattern) : c.color)
                        : c.color,
                    border: color === c.key ? '2px solid #000' : '1px solid #888',
                    borderRadius: 0,
                    minWidth: 22,
                    minHeight: 22,
                    margin: 0,
                    padding: 0,
                  }}
                  onClick={() => handleColorChange(c.key as ColorType)}
                  aria-label={c.key}
                />
              ))}
            </div>
            {/* Caption（Colourの下・ボタン群の上、マージンあり） */}
            {isManualMode && (
              <div style={{ width: '100%' }}>
                <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Caption</div>
                {/* Win98風入力フィールド */}
                <input
                  type="text"
                  value={manualCamera}
                  onChange={e => setManualCamera(e.target.value)}
                  placeholder="Camera"
                  className="retro-input mb-2"
                  style={{
                    width: '100%',
                    height: '20px',
                    background: '#fff',
                    border: '2px inset #c0c0c0',
                    borderTop: '2px solid #808080',
                    borderLeft: '2px solid #808080',
                    borderBottom: '2px solid #fff',
                    borderRight: '2px solid #fff',
                    borderRadius: 0,
                    padding: '1px 4px',
                    fontSize: '13px',
                    fontFamily: 'system-ui, sans-serif',
                    lineHeight: '16px',
                    color: '#000',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  maxLength={40}
                />
                <input
                  type="text"
                  value={manualPlace}
                  onChange={e => setManualPlace(e.target.value)}
                  placeholder="Place"
                  className="retro-input"
                  style={{
                    width: '100%',
                    height: '20px',
                    background: '#fff',
                    border: '2px inset #c0c0c0',
                    borderTop: '2px solid #808080',
                    borderLeft: '2px solid #808080',
                    borderBottom: '2px solid #fff',
                    borderRight: '2px solid #fff',
                    borderRadius: 0,
                    padding: '1px 4px',
                    fontSize: '13px',
                    fontFamily: 'system-ui, sans-serif',
                    lineHeight: '16px',
                    color: '#000',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  maxLength={40}
                />
              </div>
            )}
            {/* ボタン群 */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 28, justifyContent: 'flex-end', width: '100%' }}>
              <RetroButton variant="cancel" onClick={() => {
                setImage(null);
                setColor('white'); // 空文字列ではなく'white'にリセット
                setAutoColor('#e53e3e');
                setSnapPattern(1);
                setRetrobluePattern(1);
                setAutoPattern(1);
                setExifData(null);
                setCaptionLines(['', '']);
                setIsFilmScannerImage(false); // フィルムスキャナー判定もリセット
                setShowResetButton(false);
                setPrintStatus('idle');
                setIsPrintDisabled(false);
              }}>{showResetButton ? 'Reset' : 'Cancel'}</RetroButton>
              <RetroButton variant="primary" disabled={isPrintDisabled} onClick={() => {
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
                const frameColorOut = getFrameColor(color, autoColor, snapPattern, retrobluePattern);
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

                // Ratio 9:16の場合は中央配置、3:4画像かつRatio 5:7かつSpaces Lのときも中央配置
                const left = padLeftOut + (drawWOut - targetW) / 2;
                const is34Image = Math.abs(image.width / image.height - 3 / 4) < 0.05;
                const is45Image = Math.abs(image.width / image.height - 4 / 5) < 0.05;
                let top;
                if (ratio === '9:16' || (is34Image && ratio === '5:7' && space === 'L') || (is45Image && ratio === '5:7' && space === 'L')) {
                  top = padTopOut + (drawHOut - targetH) / 2;
                } else {
                  top = padTopOut;
                }

                // 画像を描画（クロップや拡大はしない）
                outputCtx.drawImage(image, left, top, targetW, targetH);

                // キャプション描画
                if (captionLines[0] || captionLines[1]) {
                  // モバイル用のキャプション位置調整: プレビューと同じcanvasHを使用
                  const canvasHForCaption = isMobileDevice() ? canvasH : outputH;
                  drawCaption(outputCtx, outputW, canvasHForCaption, padBottomOut, top, targetH, captionLines, frameColorOut, space, ratio, image?.width, image?.height);
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
                      // 共有成功時もPCと同じくロック＆Reset待ちにする
                      setPrintStatus('done');
                      setShowResetButton(true);
                      setIsPrintDisabled(true);
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
                  setShowResetButton(true);
                  setIsPrintDisabled(true);
                  // setTimeout(() => {
                  //   setPrintStatus('idle');
                  // }, 1500);
                }, 'image/jpeg', 1.0);
              }}>{printStatus === 'done' ? 'Done!' : 'Print'}</RetroButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- PC用レイアウト ---
  return (
    <div className="bg-[#F2F2F2] flex flex-row min-h-screen">
      <RetroErrorPopup isVisible={showErrorPopup} onClose={() => setShowErrorPopup(false)} />
      {/* タイトルカラム: 画面Y軸中央に配置 */}
      <div className="flex justify-center items-center w-[320px] h-screen">
        <Frames3DTitle 
          frameColor={(!image && color === '') ? '#111' : getFrameColor(color, autoColor, snapPattern, retrobluePattern)}
          colorKey={color}
          snapPattern={snapPattern}
          retrobluePattern={retrobluePattern}
        />
      </div>
      {/* プレビューとコントロールパネルをラップ */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* キャンバスを画面中央に絶対配置 */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: 'auto',
          height: 'auto',
        }}>
          <div
            className="relative flex justify-center items-center"
            style={{ 
              maxWidth: `${canvasW}px`, 
              maxHeight: `${canvasH}px`, 
              minWidth: 200, 
              minHeight: 280, 
              cursor: image ? 'default' : 'pointer'
            }}
            onClick={() => { if (!image) handlePlaceholderClick(); }}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              e.preventDefault();
              handleFilesUpload(e.dataTransfer.files);
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%' }}
            />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" style={{ display: 'none' }} />
          </div>
        </div>
        {/* コントローラーパネル: ドラッグ可能または固定 */}
        {ENABLE_DRAGGABLE_PANEL && isPanelInitialized ? (
          <motion.div 
            className="fixed z-10"
            style={{ 
              left: panelPos.x, 
              top: panelPos.y,
              width: 260,
              transition: dragging ? 'none' : 'left 0.05s linear, top 0.05s linear'
            }}
          >
            <div
              className="retro-panel"
              style={{
                background: '#c0c0c0',
                borderTop: '2px solid #fff',
                borderLeft: '2px solid #fff',
                borderBottom: '2px solid #808080',
                borderRight: '2px solid #808080',
                borderRadius: 0,
                padding: '12px 12px 10px 12px',
                width: 260,
                margin: '40px 0 0 0',
                boxSizing: 'border-box',
                boxShadow: '1px 1px 0 #000',
                userSelect: 'none',
              }}
            >
              {/* ドラッグハンドル（パネル上部のタイトル部分） */}
              {ENABLE_DRAGGABLE_PANEL && (
                <div
                  style={{
                    height: '20px',
                    background: '#c0c0c0',
                    borderBottom: '1px solid #808080',
                    margin: '-12px -12px 8px -12px',
                    padding: '2px 8px',
                    cursor: dragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    fontSize: '11px',
                    color: '#000',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <span>Frames</span>
                </div>
              )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Ratio */}
              <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Ratio</div>
              <div style={{ marginBottom: 10 }}>
                <SliderWithLabels
                  options={RATIOS}
                  value={ratio}
                  onChange={(newRatio) => {
                    if (isPrintDisabled) {
                      setIsPrintDisabled(false);
                      setPrintStatus('idle');
                    }
                    setRatio(newRatio);
                  }}
                  label=""
                  icons={[<RatioIcon ratio="1:1" />, <RatioIcon ratio="5:7" />, <RatioIcon ratio="9:16" />]}
                  iconPosition="above"
                  iconMargin={8}
                  trackMargin={0}
                  labelMarginLeft={0}
                  labelMarginBottom={2}
                  hideLabel={true}
                />
              </div>
              {/* Spaces */}
              <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Spaces</div>
              <div style={{ marginBottom: 10 }}>
                <SliderWithLabels
                  options={SPACES}
                  value={space}
                  onChange={(newSpace) => {
                    if (isPrintDisabled) {
                      setIsPrintDisabled(false);
                      setPrintStatus('idle');
                    }
                    setSpace(newSpace);
                  }}
                  label=""
                  iconPosition="none"
                  trackMargin={0}
                  labelMarginLeft={0}
                  labelMarginBottom={2}
                  hideLabel={true}
                />
              </div>
              {/* Colour */}
              <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Colour</div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 4, marginBottom: 20 }}>
                {COLORS.map((c, i) => (
                  <button
                    key={c.key}
                    className="flex-1 h-6 border-[1px] select-none"
                    style={{
                      background:
                        c.key === 'auto'
                          ? (image
                              ? autoColor
                              : 'linear-gradient(90deg, #e53e3e, #fbbf24, #34d399, #3b82f6, #a78bfa)')
                          : c.key === 'snap'
                          ? (color === 'snap' ? getFrameColor('snap', autoColor, snapPattern) : c.color)
                          : c.key === 'retroblue'
                          ? (color === 'retroblue' ? getFrameColor('retroblue', autoColor, snapPattern, retrobluePattern) : c.color)
                          : c.color,
                      border: color === c.key ? '2px solid #000' : '1px solid #888',
                      borderRadius: 0,
                      minWidth: 22,
                      minHeight: 22,
                      margin: 0,
                      padding: 0,
                    }}
                    onClick={() => handleColorChange(c.key as ColorType)}
                    aria-label={c.key}
                  />
                ))}
              </div>
              {/* Caption（Colourの下・ボタン群の上、マージンあり） */}
              {isManualMode && (
                <div style={{ width: '100%' }}>
                  <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Caption</div>
                  {/* Win98風入力フィールド */}
                  <input
                    type="text"
                    value={manualCamera}
                    onChange={e => setManualCamera(e.target.value)}
                    placeholder="Camera"
                    className="retro-input mb-2"
                    style={{
                      width: '100%',
                      height: '20px',
                      background: '#fff',
                      border: '2px inset #c0c0c0',
                      borderTop: '2px solid #808080',
                      borderLeft: '2px solid #808080',
                      borderBottom: '2px solid #fff',
                      borderRight: '2px solid #fff',
                      borderRadius: 0,
                      padding: '1px 4px',
                      fontSize: '13px',
                      fontFamily: 'system-ui, sans-serif',
                      lineHeight: '16px',
                      color: '#000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    maxLength={40}
                  />
                  <input
                    type="text"
                    value={manualPlace}
                    onChange={e => setManualPlace(e.target.value)}
                    placeholder="Place"
                    className="retro-input"
                    style={{
                      width: '100%',
                      height: '20px',
                      background: '#fff',
                      border: '2px inset #c0c0c0',
                      borderTop: '2px solid #808080',
                      borderLeft: '2px solid #808080',
                      borderBottom: '2px solid #fff',
                      borderRight: '2px solid #fff',
                      borderRadius: 0,
                      padding: '1px 4px',
                      fontSize: '13px',
                      fontFamily: 'system-ui, sans-serif',
                      lineHeight: '16px',
                      color: '#000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    maxLength={40}
                  />
                </div>
              )}
              {/* ボタン群 */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 28, justifyContent: 'flex-end', width: '100%' }}>
                <RetroButton variant="cancel" onClick={() => {
                  setImage(null);
                  setColor('white'); // 空文字列ではなく'white'にリセット
                  setAutoColor('#e53e3e');
                  setSnapPattern(1);
                  setRetrobluePattern(1);
                  setAutoPattern(1);
                  setExifData(null);
                  setCaptionLines(['', '']);
                  setIsFilmScannerImage(false); // フィルムスキャナー判定もリセット
                  setShowResetButton(false);
                  setPrintStatus('idle');
                  setIsPrintDisabled(false);
                }}>{showResetButton ? 'Reset' : 'Cancel'}</RetroButton>
                <RetroButton variant="primary" disabled={isPrintDisabled} onClick={() => {
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
                  const frameColorOut = getFrameColor(color, autoColor, snapPattern, retrobluePattern);
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

                  // Ratio 9:16の場合は中央配置、それ以外は上詰め配置
                  const left = padLeftOut + (drawWOut - targetW) / 2;
                  const top = ratio === '9:16' ? padTopOut + (drawHOut - targetH) / 2 : padTopOut;

                  // 画像を描画（クロップや拡大はしない）
                  outputCtx.drawImage(image, left, top, targetW, targetH);

                  // キャプション描画
                  if (captionLines[0] || captionLines[1]) {
                    // モバイル用のキャプション位置調整: プレビューと同じcanvasHを使用
                    const canvasHForCaption = isMobileDevice() ? canvasH : outputH;
                    drawCaption(outputCtx, outputW, canvasHForCaption, padBottomOut, top, targetH, captionLines, frameColorOut, space, ratio, image?.width, image?.height);
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
                        // 共有成功時もPCと同じくロック＆Reset待ちにする
                        setPrintStatus('done');
                        setShowResetButton(true);
                        setIsPrintDisabled(true);
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
                    setShowResetButton(true);
                    setIsPrintDisabled(true);
                    // setTimeout(() => {
                    //   setPrintStatus('idle');
                    // }, 1500);
                  }, 'image/jpeg', 1.0);
                }}>{printStatus === 'done' ? 'Done!' : 'Print'}</RetroButton>
              </div>
            </div>
          </div>
        </motion.div>
        ) : (
          // 固定パネル版（従来の仕様）
          <div
            className="retro-panel"
            style={{
              background: '#c0c0c0',
              borderTop: '2px solid #fff',
              borderLeft: '2px solid #fff',
              borderBottom: '2px solid #808080',
              borderRight: '2px solid #808080',
              borderRadius: 0,
              padding: '12px 12px 10px 12px',
              width: 260,
              margin: '40px 0 0 0',
              boxSizing: 'border-box',
              boxShadow: '1px 1px 0 #000',
              position: 'fixed',
              top: '50%',
              right: '40px',
              transform: 'translateY(-50%)',
              zIndex: 10,
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Ratio */}
              <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Ratio</div>
              <div style={{ marginBottom: 10 }}>
                <SliderWithLabels
                  options={RATIOS}
                  value={ratio}
                  onChange={(newRatio) => {
                    if (isPrintDisabled) {
                      setIsPrintDisabled(false);
                      setPrintStatus('idle');
                    }
                    setRatio(newRatio);
                  }}
                  label=""
                  icons={[<RatioIcon ratio="1:1" />, <RatioIcon ratio="5:7" />, <RatioIcon ratio="9:16" />]}
                  iconPosition="above"
                  iconMargin={8}
                  trackMargin={0}
                  labelMarginLeft={0}
                  labelMarginBottom={2}
                  hideLabel={true}
                />
              </div>
              {/* Spaces */}
              <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Spaces</div>
              <div style={{ marginBottom: 10 }}>
                <SliderWithLabels
                  options={SPACES}
                  value={space}
                  onChange={(newSpace) => {
                    if (isPrintDisabled) {
                      setIsPrintDisabled(false);
                      setPrintStatus('idle');
                    }
                    setSpace(newSpace);
                  }}
                  label=""
                  iconPosition="none"
                  trackMargin={0}
                  labelMarginLeft={0}
                  labelMarginBottom={2}
                  hideLabel={true}
                />
              </div>
              {/* Colour */}
              <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Colour</div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 4, marginBottom: 20 }}>
                {COLORS.map((c, i) => (
                  <button
                    key={c.key}
                    className="flex-1 h-6 border-[1px] select-none"
                    style={{
                      background:
                        c.key === 'auto'
                          ? (image
                              ? autoColor
                              : 'linear-gradient(90deg, #e53e3e, #fbbf24, #34d399, #3b82f6, #a78bfa)')
                          : c.key === 'snap'
                          ? (color === 'snap' ? getFrameColor('snap', autoColor, snapPattern) : c.color)
                          : c.key === 'retroblue'
                          ? (color === 'retroblue' ? getFrameColor('retroblue', autoColor, snapPattern, retrobluePattern) : c.color)
                          : c.color,
                      border: color === c.key ? '2px solid #000' : '1px solid #888',
                      borderRadius: 0,
                      minWidth: 22,
                      minHeight: 22,
                      margin: 0,
                      padding: 0,
                    }}
                    onClick={() => handleColorChange(c.key as ColorType)}
                    aria-label={c.key}
                  />
                ))}
              </div>
              {/* Caption（Colourの下・ボタン群の上、マージンあり） */}
              {isManualMode && (
                <div style={{ width: '100%' }}>
                  <div className="retro-label" style={{ fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 2, textAlign: 'left', justifyContent: 'flex-start', display: 'flex' }}>Caption</div>
                  {/* Win98風入力フィールド */}
                  <input
                    type="text"
                    value={manualCamera}
                    onChange={e => setManualCamera(e.target.value)}
                    placeholder="Camera"
                    className="retro-input mb-2"
                    style={{
                      width: '100%',
                      height: '20px',
                      background: '#fff',
                      border: '2px inset #c0c0c0',
                      borderTop: '2px solid #808080',
                      borderLeft: '2px solid #808080',
                      borderBottom: '2px solid #fff',
                      borderRight: '2px solid #fff',
                      borderRadius: 0,
                      padding: '1px 4px',
                      fontSize: '13px',
                      fontFamily: 'system-ui, sans-serif',
                      lineHeight: '16px',
                      color: '#000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    maxLength={40}
                  />
                  <input
                    type="text"
                    value={manualPlace}
                    onChange={e => setManualPlace(e.target.value)}
                    placeholder="Place"
                    className="retro-input"
                    style={{
                      width: '100%',
                      height: '20px',
                      background: '#fff',
                      border: '2px inset #c0c0c0',
                      borderTop: '2px solid #808080',
                      borderLeft: '2px solid #808080',
                      borderBottom: '2px solid #fff',
                      borderRight: '2px solid #fff',
                      borderRadius: 0,
                      padding: '1px 4px',
                      fontSize: '13px',
                      fontFamily: 'system-ui, sans-serif',
                      lineHeight: '16px',
                      color: '#000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    maxLength={40}
                  />
                </div>
              )}
              {/* ボタン群 */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 28, justifyContent: 'flex-end', width: '100%' }}>
                <RetroButton variant="cancel" onClick={() => {
                  setImage(null);
                  setColor('white'); // 空文字列ではなく'white'にリセット
                  setAutoColor('#e53e3e');
                  setSnapPattern(1);
                  setRetrobluePattern(1);
                  setAutoPattern(1);
                  setExifData(null);
                  setCaptionLines(['', '']);
                  setIsFilmScannerImage(false); // フィルムスキャナー判定もリセット
                  setShowResetButton(false);
                  setPrintStatus('idle');
                  setIsPrintDisabled(false);
                }}>{showResetButton ? 'Reset' : 'Cancel'}</RetroButton>
                <RetroButton variant="primary" disabled={isPrintDisabled} onClick={() => {
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
                  const frameColorOut = getFrameColor(color, autoColor, snapPattern, retrobluePattern);
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

                  // Ratio 9:16の場合は中央配置、3:4画像かつRatio 5:7かつSpaces Lのときも中央配置
                  const left = padLeftOut + (drawWOut - targetW) / 2;
                  const is34Image = Math.abs(image.width / image.height - 3 / 4) < 0.05;
                  const is45Image = Math.abs(image.width / image.height - 4 / 5) < 0.05;
                  let top;
                  if (ratio === '9:16' || (is34Image && ratio === '5:7' && space === 'L') || (is45Image && ratio === '5:7' && space === 'L')) {
                    top = padTopOut + (drawHOut - targetH) / 2;
                  } else {
                    top = padTopOut;
                  }

                  // 画像を描画（クロップや拡大はしない）
                  outputCtx.drawImage(image, left, top, targetW, targetH);

                  // キャプション描画
                  if (captionLines[0] || captionLines[1]) {
                    // モバイル用のキャプション位置調整: プレビューと同じcanvasHを使用
                    const canvasHForCaption = isMobileDevice() ? canvasH : outputH;
                    drawCaption(outputCtx, outputW, canvasHForCaption, padBottomOut, top, targetH, captionLines, frameColorOut, space, ratio, image?.width, image?.height);
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
                        // 共有成功時もPCと同じくロック＆Reset待ちにする
                        setPrintStatus('done');
                        setShowResetButton(true);
                        setIsPrintDisabled(true);
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
                    setShowResetButton(true);
                    setIsPrintDisabled(true);
                    // setTimeout(() => {
                    //   setPrintStatus('idle');
                    // }, 1500);
                  }, 'image/jpeg', 1.0);
                }}>{printStatus === 'done' ? 'Done!' : 'Print'}</RetroButton>
              </div> 
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FramesTool;
