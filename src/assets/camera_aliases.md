# Camera Aliases Documentation

このファイルは`camera_aliases.json`の各セクションの役割を説明するドキュメントです。

## セクションの役割

### `manufacturers`
**目的**: メーカー名の正規化
- EXIFのMakeフィールドから表示用のメーカー名への変換
- 例: `"RICOH IMAGING COMPANY, LTD."` → `"RICOH"`

**追加時の注意点**:
- 正式なメーカー名から表示用の短縮名への変換のみ
- ブランド名の統一を目的とする

### `models`
**目的**: 型番から読みやすいモデル名への変換
- EXIFのModelフィールドから表示用のモデル名への変換
- 例: `"ILCE-7M3"` → `"α7 III"`

**追加時の注意点**:
- メーカー名は含まない（manufacturersセクションで処理）
- 型番がそのまま表示される場合は追加不要
- 読みやすさを向上させる変換のみ

### `aliases`
**目的**: 特殊なケースの完全なカメラ名への変換
- manufacturers + modelsの組み合わせでは処理できない場合のみ使用

**追加時の注意点**:
- manufacturers + modelsで自動生成できるものは含めない
- 例: `"iPhone15,2"` → `"iPhone 15 Pro"`（スマートフォンの特殊な命名）
- 例: `"DC-G9"` → `"Panasonic G9 Pro"`（「Pro」が追加される特殊ケース）

## 処理優先順位
1. `aliases`で完全一致 → そのまま返す
2. `manufacturers` + `models`の組み合わせで自動生成
3. 重複除去ロジックで最終的な表示名を決定 