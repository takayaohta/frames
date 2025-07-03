import cameraAliases from '../assets/camera_aliases.json';

export interface ExifData {
  Make?: string;
  Model?: string;
  ISO?: number;
  FNumber?: number;
  ExposureTime?: number;
  Software?: string;
}

// 製造元名の正規化
function normalizeMake(make?: string): string {
  if (!make) return '';
  
  const manufacturers = (cameraAliases as any).manufacturers || {};
  return manufacturers[make] || make;
}

// 機種名の正規化
function normalizeModel(model?: string): string {
  if (!model) return '';
  
  const models = (cameraAliases as any).models || {};
  return models[model] || model;
}

// 重複除去とキャプション生成
function generateCameraName(make?: string, model?: string): string {
  if (!model) return '';
  
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  // 製造元名と機種名に同じ文字列が含まれる場合の重複除去
  if (normalizedMake && normalizedModel) {
    const makeLower = normalizedMake.toLowerCase();
    const modelLower = normalizedModel.toLowerCase();
    
    // 製造元名が機種名に含まれている場合
    if (modelLower.includes(makeLower)) {
      return normalizedModel;
    }
    
    // 機種名が製造元名に含まれている場合
    if (makeLower.includes(modelLower)) {
      return normalizedMake;
    }
  }
  
  // 通常の組み合わせ
  if (normalizedMake && normalizedModel) {
    return `${normalizedMake} ${normalizedModel}`;
  }
  
  return normalizedModel || normalizedMake || '';
}

function getCameraName(make?: string, model?: string): string {
  if (!model) return '';
  
  // エイリアスファイル優先
  const aliases = (cameraAliases as any).aliases || {};
  if (aliases[model]) {
    return aliases[model];
  }
  
  // 自動処理
  return generateCameraName(make, model);
}

function getExposureString(exposure?: number): string {
  if (!exposure) return '';
  if (exposure >= 1) return `${exposure.toFixed(1)}s`;
  // 1/xxx形式
  return `1/${Math.round(1 / exposure)}s`;
}

function getFNumberString(fNumber?: number): string {
  if (!fNumber) return '';
  const rounded = fNumber.toFixed(1);
  // 小数点以下が0の場合は整数として表示
  const displayValue = rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
  return `f${displayValue}`;
}

export function getCaptionLines(exif: ExifData): [string, string] {
  // Line 1: Shot on [カメラ名]
  const camera = getCameraName(exif.Make, exif.Model);
  const line1 = camera ? `Shot on ${camera}` : '';

  // Line 2: ISO 200 / f2.8 / 1/125s
  const iso = exif.ISO ? `ISO ${exif.ISO}` : '';
  const fnum = getFNumberString(exif.FNumber);
  const exp = getExposureString(exif.ExposureTime);
  const settings = [iso, fnum, exp].filter(Boolean).join(' / ');
  return [line1, settings];
} 