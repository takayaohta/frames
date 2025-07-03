import filmScannerData from '../assets/film_scanners.json';
import { FilmScannerData } from '../types/json';

// フィルムスキャナーデータの型安全な読み込み
const filmScanners = (filmScannerData as FilmScannerData).film_scanners;

/**
 * 指定されたメーカー名がフィルムスキャナーメーカーかどうかを判定
 * @param manufacturer メーカー名
 * @returns フィルムスキャナーメーカーの場合true
 */
export function isFilmScanner(manufacturer: string): boolean {
  if (!manufacturer) return false;
  
  return filmScanners.some(scanner => 
    manufacturer.toUpperCase().includes(scanner.toUpperCase())
  );
}

/**
 * フィルムスキャナーメーカーのリストを取得
 * @returns フィルムスキャナーメーカーの配列
 */
export function getFilmScannerList(): string[] {
  return [...filmScanners];
}

/**
 * MakeまたはSoftwareからフィルムスキャン画像か判定するユーティリティ
 * @param make EXIFのMake
 * @param software EXIFのSoftware
 * @returns フィルムスキャナーまたはNegative Lab Proならtrue
 */
export function isFilmScanExif(make?: string, software?: string): boolean {
  if (isFilmScanner(make || '')) return true;
  if (typeof software === 'string' && software.toLowerCase().includes('negative lab pro')) return true;
  return false;
} 