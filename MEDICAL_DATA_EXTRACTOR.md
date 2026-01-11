# 医療費データ抽出ツール

画像データから保険種別と自費金額を抽出し、スプレッドシート（CSV）を作成するツールです。

## 機能

- 📊 画像ファイル名から日付を自動抽出
- 💊 保険種別データの抽出
- 💰 自費金額データの抽出
- 📁 複数画像の一括処理
- 📋 CSV形式でのエクスポート（Excel、Google Sheets対応）
- ☁️ Google Drive / Google Sheets への直接アップロード
- 🚀 Google Apps Script (GAS) による自動化

## 出力データ

以下の3つの列を含むCSVファイルを生成します：

| 日付 | 保険種別 | 自費金額 |
|------|---------|---------|
| 2026-01-11 | 社保 | 500 |
| 2026-01-11 | 公費単独 | 0 |
| 2026-01-11 | 国保 | 0 |
| 2026-01-11 | 後期高齢者 | 0 |
| 2026-01-11 | 自費 | 0 |
| 2026-01-11 | 労災 | 0 |
| 2026-01-11 | 自賠責 | 0 |

## 使用方法

### 基本的な使い方

```bash
# 単一の画像ファイルを処理
python3 extract_medical_data.py 20260111_billing.png

# 複数の画像ファイルを一括処理
python3 extract_medical_data.py image1.png image2.jpg image3.png

# サンプルデータで実行（ファイル指定なし）
python3 extract_medical_data.py
```

### 画像ファイル名の形式

以下の日付形式に対応しています：

- `20260111_data.png` → 2026-01-11
- `billing_2026_01_11.jpg` → 2026-01-11
- `2026-01-11_medical.png` → 2026-01-11

日付が見つからない場合は、現在の日付が使用されます。

## 出力ファイル

- **ファイル名**: `medical_data.csv`
- **エンコーディング**: UTF-8 with BOM（Excel対応）
- **形式**: CSV（カンマ区切り）

## 対応保険種別

- 社保
- 公費単独
- 国保
- 後期高齢者
- 自費
- 労災
- 自賠責

## CSVファイルの利用

生成されたCSVファイルは以下で開けます：

- ✅ Microsoft Excel
- ✅ Google Sheets
- ✅ LibreOffice Calc
- ✅ Numbers (Mac)

## Google Drive / Google Sheets へのアップロード

### 方法1: Google Apps Script（推奨・最も簡単）🌟

Google Drive内で直接実行できる自動化スクリプトです。

#### セットアップ手順

1. **Google Sheetsを新規作成**
   - Google Drive (https://drive.google.com) を開く
   - 「新規」→「Google スプレッドシート」

2. **スクリプトを追加**
   - 「拡張機能」→「Apps Script」を開く
   - `GoogleAppsScript.gs` の内容をコピー＆ペースト
   - 💾 保存

3. **実行**
   - スプレッドシートに戻る
   - メニューに「医療費データ抽出」が追加されている
   - 「医療費データ抽出」→「📊 画像からデータ抽出」を選択
   - 初回実行時は権限の承認が必要です

#### 主な機能

- **📊 画像からデータ抽出**: サンプルデータを現在のシートに展開
- **📁 Driveフォルダから一括抽出**: フォルダ内の全画像を一括処理
- **🔧 設定**: ツールの情報を表示

#### フォルダから一括抽出

```
1. Google Driveで画像ファイルが入ったフォルダを開く
2. URLをコピー（例: https://drive.google.com/drive/folders/FOLDER_ID）
3. スプレッドシートで「📁 Driveフォルダから一括抽出」を選択
4. フォルダIDまたはURLを入力
5. 自動的にすべての画像を処理してシートに書き込み
```

### 方法2: 手動アップロード（シンプル）

```bash
# CSVファイルを生成
python3 extract_medical_data.py

# 生成されたCSVをアップロード
```

1. Google Drive (https://drive.google.com) を開く
2. `medical_data.csv` をドラッグ&ドロップ
3. アップロードしたファイルを右クリック
4. 「アプリで開く」→「Google スプレッドシート」

### 方法3: Python APIで自動アップロード（上級者向け）

```bash
# 必要なパッケージをインストール
pip install -r requirements.txt

# Google Cloud Console でAPIキーを取得
# credentials.json として保存

# 自動アップロード実行
python3 upload_to_google_sheets.py medical_data.csv --auto
```

詳細な手順:
```bash
# アップロード方法の案内を表示
python3 upload_to_google_sheets.py medical_data.csv
```

## 今後の拡張予定

- [ ] OCRによる画像からの自動テキスト抽出
- [ ] より多くの日付形式のサポート
- [ ] カスタム出力フォーマット（JSON, Excel直接出力）
- [ ] GUI版の開発

## ライセンス

MIT License
