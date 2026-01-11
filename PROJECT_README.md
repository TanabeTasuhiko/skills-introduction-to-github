# 医療費データ抽出ツール

画像データから保険種別と自費金額を抽出し、Google Sheetsで管理できるスプレッドシートを自動生成するツールです。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.7+](https://img.shields.io/badge/python-3.7+-blue.svg)](https://www.python.org/downloads/)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-Ready-green.svg)](https://script.google.com/)

## ✨ 特徴

- 🖼️ **画像処理**: ファイル名から自動的に日付を抽出
- 📊 **データ構造化**: 保険種別と自費金額を表形式で整理
- ☁️ **クラウド統合**: Google Drive / Google Sheets に直接アップロード
- 🚀 **自動化**: Google Apps Script でワンクリック実行
- 📁 **バッチ処理**: 複数の画像ファイルを一括処理
- 💻 **クロスプラットフォーム**: Python版とGAS版の両方を提供

## 📦 ファイル構成

```
.
├── extract_medical_data.py          # メインのデータ抽出スクリプト (Python)
├── upload_to_google_sheets.py       # Google Sheets アップロードツール
├── GoogleAppsScript.gs              # Google Apps Script版（推奨）
├── medical_data.csv                 # サンプル出力データ
├── requirements.txt                 # Python依存パッケージ
├── MEDICAL_DATA_EXTRACTOR.md        # 詳細ドキュメント
├── QUICKSTART_GOOGLE_APPS_SCRIPT.md # クイックスタートガイド
└── PROJECT_README.md                # このファイル
```

## 🚀 クイックスタート

### 方法A: Google Apps Script（最も簡単・推奨）

**所要時間: 3分**

1. [クイックスタートガイド](./QUICKSTART_GOOGLE_APPS_SCRIPT.md)を参照
2. Google Sheetsで新しいスプレッドシートを作成
3. `GoogleAppsScript.gs` の内容をコピー＆ペースト
4. メニューから実行

→ 詳しくは [QUICKSTART_GOOGLE_APPS_SCRIPT.md](./QUICKSTART_GOOGLE_APPS_SCRIPT.md) へ

### 方法B: Python版（ローカル実行）

```bash
# リポジトリをクローン
git clone https://github.com/TanabeTasuhiko/skills-introduction-to-github.git
cd skills-introduction-to-github

# スクリプトを実行
python3 extract_medical_data.py

# CSVファイルが生成される
# medical_data.csv が作成されます
```

## 📊 出力例

| 日付 | 保険種別 | 自費金額 |
|------------|----------|----------|
| 2026-01-11 | 社保 | 500 |
| 2026-01-11 | 国保 | 0 |
| 2026-01-11 | 後期高齢者 | 0 |

## 🎯 使用例

### ケース1: 月次レポート作成

```python
# 1月分の画像を一括処理
python3 extract_medical_data.py 202601*.png

# Google Sheetsにアップロード
python3 upload_to_google_sheets.py medical_data.csv
```

### ケース2: Google Drive内で完結

```
1. Google Driveで画像フォルダを作成
2. Google Sheetsでスクリプトを実行
3. フォルダIDを入力して一括抽出
4. 自動的にスプレッドシートに整理
```

## 📋 対応保険種別

- 社保（社会保険）
- 公費単独
- 国保（国民健康保険）
- 後期高齢者
- 自費
- 労災
- 自賠責

## 🗓️ 対応日付形式

ファイル名から以下の形式を自動認識：

- `20260111_data.png` → 2026-01-11
- `billing_2026_01_11.jpg` → 2026-01-11
- `2026-01-11_medical.png` → 2026-01-11
- `report-2026_01_11.jpeg` → 2026-01-11

## 🔧 環境構築（Python版を使う場合）

### 必要要件

- Python 3.7以上
- (オプション) Google Cloud アカウント（API使用時）

### インストール

```bash
# 依存パッケージをインストール
pip install -r requirements.txt
```

## 📚 ドキュメント

- [📖 詳細マニュアル](./MEDICAL_DATA_EXTRACTOR.md) - 全機能の詳細説明
- [🚀 クイックスタート](./QUICKSTART_GOOGLE_APPS_SCRIPT.md) - 3分で始める
- [💾 サンプルデータ](./medical_data.csv) - 出力例

## 🛠️ 開発ロードマップ

- [x] ファイル名から日付抽出
- [x] CSV形式でのエクスポート
- [x] Google Apps Script統合
- [x] Google Drive一括処理
- [ ] OCR機能（画像からテキスト自動抽出）
- [ ] GUI版の開発
- [ ] Excelファイル直接出力
- [ ] データベース連携

## 🤝 コントリビューション

プルリクエストは歓迎します！以下の手順で：

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下でライセンスされています。
詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- Google Apps Script コミュニティ
- Python データサイエンスコミュニティ
- すべてのコントリビューター

## 📞 サポート

問題が発生した場合:

1. [Issues](https://github.com/TanabeTasuhiko/skills-introduction-to-github/issues) で既存の問題を検索
2. 見つからない場合は新しいIssueを作成
3. [ドキュメント](./MEDICAL_DATA_EXTRACTOR.md)を確認

## 🌟 Star をお願いします！

このプロジェクトが役立った場合は、ぜひ ⭐️ をお願いします！

---

**作成日**: 2026-01-11
**バージョン**: 1.0.0
**メンテナー**: [@TanabeTasuhiko](https://github.com/TanabeTasuhiko)
