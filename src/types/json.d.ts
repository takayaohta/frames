declare module "*.json" {
  const value: any;
  export default value;
}

// フィルムスキャナー情報の型定義
export interface FilmScannerData {
  film_scanners: string[];
} 