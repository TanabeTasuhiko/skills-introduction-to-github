# 🛠️ 実装ガイド: OCR機能でのデータ抽出

実際に画像からデータを抽出する機能を実装する完全ガイドです。

## 📑 目次

1. [Python版の実装（Tesseract OCR）](#python版の実装)
2. [Google Apps Script版の実装（Cloud Vision API）](#google-apps-script版の実装)
3. [カスタマイズ方法](#カスタマイズ方法)
4. [トラブルシューティング](#トラブルシューティング)

---

## 🐍 Python版の実装

### 前提条件

- Python 3.7以上
- pip（Pythonパッケージマネージャー）

### ステップ1: Tesseract OCRのインストール

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install tesseract-ocr tesseract-ocr-jpn
```

#### macOS

```bash
brew install tesseract tesseract-lang
```

#### Windows

1. [Tesseract インストーラー](https://github.com/UB-Mannheim/tesseract/wiki)からダウンロード
2. インストール時に「Additional language data」で日本語を選択
3. インストールパス（例: `C:\Program Files\Tesseract-OCR`）を環境変数PATHに追加

#### インストール確認

```bash
tesseract --version
```

出力例:
```
tesseract 5.3.0
```

### ステップ2: Pythonパッケージのインストール

```bash
# requirements.txtを更新
pip install pillow pytesseract numpy
```

または:

```bash
pip install -r requirements.txt
```

### ステップ3: スクリプトの実行

#### 基本的な使い方

```bash
# 単一画像を処理
python3 extract_with_ocr.py 20260111_billing.png

# 複数画像を一括処理
python3 extract_with_ocr.py image1.png image2.png image3.png

# ワイルドカードで全画像を処理
python3 extract_with_ocr.py *.png
```

#### 画像前処理を使用（OCR精度向上）

```bash
# 1. 画像を前処理
python3 image_utils.py input.png enhanced.png

# 2. 前処理済み画像でOCR実行
python3 extract_with_ocr.py enhanced.png
```

#### テスト画像で試す

```bash
# テスト画像を生成
python3 image_utils.py --create-test

# テスト画像で実行
python3 extract_with_ocr.py sample_medical_data.png
```

### ステップ4: データ解析のカスタマイズ

`extract_with_ocr.py` の `parse_medical_data` メソッドを編集:

```python
def parse_medical_data(self, text: str) -> List[Dict]:
    """実際のデータフォーマットに合わせてカスタマイズ"""
    results = []
    lines = text.split('\n')

    for line in lines:
        # 🔧 ここを実際のデータ構造に合わせて調整

        # 例1: 「社保」という文字列が含まれる行を探す
        if '社保' in line:
            # 数値を抽出
            numbers = re.findall(r'[\d,]+', line)
            # 最後の数値を自費金額と仮定
            amount = int(numbers[-1].replace(',', '')) if numbers else 0

            results.append({
                '保険種別': '社保',
                '自費金額': amount
            })

    return results
```

### ステップ5: 結果の確認

```bash
# CSVファイルが生成される
cat medical_data.csv

# Google Sheetsにアップロード
python3 upload_to_google_sheets.py medical_data.csv
```

---

## ☁️ Google Apps Script版の実装

### 前提条件

- Googleアカウント
- Google Cloud Platformアカウント（無料）

### ステップ1: Google Cloud Projectのセットアップ

#### 1.1 プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com) を開く
2. 画面上部の「プロジェクトを選択」をクリック
3. 「新しいプロジェクト」をクリック
4. プロジェクト名を入力（例: `medical-data-extractor`）
5. 「作成」をクリック

#### 1.2 Cloud Vision APIの有効化

1. 左メニューから「APIとサービス」→「ライブラリ」を選択
2. 検索ボックスに「Cloud Vision API」と入力
3. 「Cloud Vision API」をクリック
4. 「有効にする」をクリック

#### 1.3 APIキーの作成

1. 左メニューから「APIとサービス」→「認証情報」を選択
2. 画面上部の「認証情報を作成」→「APIキー」をクリック
3. APIキーが生成される（例: `AIzaSyC...`）
4. 🔑 **このAPIキーをコピーして安全な場所に保存**

#### 1.4 APIキーの制限（推奨）

1. 作成したAPIキーの右側の「︙」→「APIキーを編集」
2. 「アプリケーションの制限」で「HTTPリファラー」を選択
3. 「APIの制限」で「キーを制限」を選択
4. 「Cloud Vision API」のみを選択
5. 「保存」をクリック

### ステップ2: Google Sheetsでのセットアップ

#### 2.1 スプレッドシートの作成

1. [Google Drive](https://drive.google.com) を開く
2. 「新規」→「Google スプレッドシート」
3. わかりやすい名前に変更（例: `医療費データ管理 (OCR)`）

#### 2.2 スクリプトの追加

1. 「拡張機能」→「Apps Script」を開く
2. デフォルトのコードを全て削除
3. `GoogleAppsScript_CloudVision.gs` の内容をコピー＆ペースト
4. **重要**: 2行目の `API_KEY` にコピーしたAPIキーを貼り付け

```javascript
const API_KEY = 'AIzaSyC...あなたのAPIキー...';
```

5. 💾 保存（Ctrl+S）
6. プロジェクト名を入力（例: `医療費OCR抽出`）

#### 2.3 権限の承認

1. スプレッドシートのタブに戻る
2. ページを更新（F5）
3. メニューに「医療費データ抽出 (OCR)」が追加される
4. 「医療費データ抽出 (OCR)」→「🔧 API設定」をクリック
5. 初回のみ権限の承認が必要

### ステップ3: 画像の準備とアップロード

#### 3.1 画像をGoogle Driveにアップロード

1. Google Driveで新しいフォルダを作成（例: `医療費画像`）
2. 画像ファイルをアップロード
3. ファイル名に日付を含める（例: `20260115_billing.png`）

#### 3.2 ファイルIDの取得

**方法A: URLから取得**

1. 画像ファイルを開く
2. URLをコピー
3. URLの形式: `https://drive.google.com/file/d/FILE_ID/view`
4. `FILE_ID` 部分がファイルID

**方法B: 共有リンクから取得**

1. ファイルを右クリック→「共有」→「リンクをコピー」
2. URLから長い英数字部分を抽出

### ステップ4: OCRの実行

#### 単一画像の処理

1. スプレッドシートで「医療費データ抽出 (OCR)」→「📊 画像からデータ抽出 (OCR)」
2. ファイルIDまたはURLを入力
3. 「OK」をクリック
4. 処理完了を待つ（数秒〜数十秒）
5. シートにデータが表示される

#### フォルダから一括処理

1. Google Driveでフォルダを開く
2. URLをコピー（例: `https://drive.google.com/drive/folders/FOLDER_ID`）
3. スプレッドシートで「📁 Driveフォルダから一括抽出 (OCR)」を選択
4. フォルダIDまたはURLを入力
5. 「OK」をクリック
6. すべての画像が自動処理される

### ステップ5: 結果の確認と活用

#### データの確認

生成されたスプレッドシートには以下の列が含まれます:

| ファイル名 | 日付 | 保険種別 | 自費金額 | ファイルURL |
|-----------|------|---------|---------|------------|

#### データの分析

```
# ピボットテーブルで集計
1. 「挿入」→「ピボットテーブル」
2. 行: 保険種別
3. 値: 自費金額（合計）

# グラフの作成
1. データ範囲を選択
2. 「挿入」→「グラフ」
3. グラフの種類を選択
```

---

## 🔧 カスタマイズ方法

### Python版のカスタマイズ

#### データ解析ロジックの変更

`extract_with_ocr.py` の `parse_medical_data` メソッドを編集:

```python
def parse_medical_data(self, text: str) -> List[Dict]:
    """実際のフォーマットに合わせてカスタマイズ"""
    results = []

    # 🔧 ステップ1: 行ごとに分割
    lines = text.split('\n')

    # 🔧 ステップ2: 各行を解析
    for line in lines:
        # デバッグ出力（開発時のみ）
        print(f"処理中の行: {line}")

        # 🔧 ステップ3: 保険種別を検索
        insurance_type = None
        for ins in self.insurance_types:
            if ins in line:
                insurance_type = ins
                break

        if not insurance_type:
            continue

        # 🔧 ステップ4: 金額を抽出
        # 例: 「自費金額: 500」のような形式の場合
        match = re.search(r'自費金額[:\s]*(\d+)', line)
        if match:
            amount = int(match.group(1))
        else:
            # 代替: 行の最後の数値を取得
            numbers = re.findall(r'\d+', line)
            amount = int(numbers[-1]) if numbers else 0

        results.append({
            '保険種別': insurance_type,
            '自費金額': amount
        })

    return results
```

#### OCR設定の調整

```python
# Tesseractの設定をカスタマイズ
text = pytesseract.image_to_string(
    img,
    lang='jpn+eng',
    config='--psm 6 --oem 3'
    # PSM (Page Segmentation Mode):
    # 0 = 画像の方向と文字列検出のみ
    # 1 = 自動ページセグメンテーション（OSD付き）
    # 3 = 完全自動ページセグメンテーション（デフォルト）
    # 6 = 単一の均一なテキストブロック
    # 11 = まばらなテキスト

    # OEM (OCR Engine Mode):
    # 0 = レガシーエンジンのみ
    # 1 = ニューラルネットワークLSTMエンジンのみ
    # 2 = レガシー + LSTM
    # 3 = デフォルト（利用可能なものを使用）
)
```

### Google Apps Script版のカスタマイズ

#### データ解析ロジックの変更

`GoogleAppsScript_CloudVision.gs` の `parseMedicalData` 関数を編集:

```javascript
function parseMedicalData(text, fileName) {
  const insuranceTypes = ['社保', '国保', '後期高齢者', '自費', '労災', '自賠責'];
  const date = extractDateFromFilename(fileName);
  const results = [];

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 🔧 デバッグ出力（ログで確認）
    Logger.log(`処理中の行: ${line}`);

    // 🔧 保険種別を検索
    let insuranceType = null;
    for (let j = 0; j < insuranceTypes.length; j++) {
      if (line.includes(insuranceTypes[j])) {
        insuranceType = insuranceTypes[j];
        break;
      }
    }

    if (!insuranceType) {
      continue;
    }

    // 🔧 金額を抽出（実際のフォーマットに合わせて調整）
    // 例1: 「自費金額: 500」のような形式
    const match = line.match(/自費金額[:\s]*(\d+)/);
    let selfPayAmount = 0;

    if (match) {
      selfPayAmount = parseInt(match[1]);
    } else {
      // 例2: 行の最後の数値を取得
      const numbers = line.match(/\d+/g);
      if (numbers) {
        selfPayAmount = parseInt(numbers[numbers.length - 1]);
      }
    }

    results.push({
      '日付': date,
      '保険種別': insuranceType,
      '自費金額': selfPayAmount
    });
  }

  return results;
}
```

---

## 🐛 トラブルシューティング

### Python版

#### エラー: `tesseract is not installed`

**原因**: Tesseract OCRがインストールされていない

**解決方法**:
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr tesseract-ocr-jpn

# macOS
brew install tesseract tesseract-lang

# Windows
# https://github.com/UB-Mannheim/tesseract/wiki からインストーラーをダウンロード
```

#### エラー: 日本語が認識されない

**原因**: 日本語データがインストールされていない

**解決方法**:
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr-jpn

# macOS
brew install tesseract-lang

# 確認
tesseract --list-langs
# jpnが表示されればOK
```

#### OCR精度が低い

**解決方法1**: 画像を前処理

```bash
python3 image_utils.py input.png enhanced.png
python3 extract_with_ocr.py enhanced.png
```

**解決方法2**: 画像の解像度を上げる

- 元画像が低解像度の場合、スキャン時のDPIを上げる（推奨: 300DPI以上）

**解決方法3**: OCR設定を調整

```python
# extract_with_ocr.py の設定を変更
config='--psm 6 --oem 1'  # 異なる設定を試す
```

### Google Apps Script版

#### エラー: `APIキーが設定されていません`

**原因**: スクリプトにAPIキーが設定されていない

**解決方法**:
1. Apps Scriptエディタを開く
2. 2行目の `API_KEY` を確認
3. 正しいAPIキーを設定
4. 保存して再実行

#### エラー: `Vision API Error: API_KEY_INVALID`

**原因**: APIキーが無効

**解決方法**:
1. Google Cloud Consoleで新しいAPIキーを作成
2. Cloud Vision APIが有効化されていることを確認
3. APIキーの制限設定を確認

#### エラー: `Vision API Error: PERMISSION_DENIED`

**原因**: 課金が有効化されていない、または権限不足

**解決方法**:
1. Google Cloud Consoleで「お支払い」を開く
2. 請求先アカウントを設定（無料枠内でも必要）
3. Cloud Vision APIが有効化されていることを再確認

#### OCR精度が低い（GAS版）

**解決方法1**: 画像の品質を上げる

- 高解像度の画像を使用
- コントラストの高い画像を使用
- ノイズの少ない画像を使用

**解決方法2**: 表部分だけを切り出す

画像編集ツールで表の部分だけを切り出してから処理

---

## 💡 ベストプラクティス

### 画像の準備

1. **高解像度**: 300DPI以上推奨
2. **コントラスト**: 白背景に黒文字が理想
3. **傾き補正**: まっすぐスキャン
4. **ノイズ除去**: クリーンな画像
5. **ファイル名**: 日付を含める（例: `20260115_billing.png`）

### データ検証

```python
# 抽出後に検証
df = pd.read_csv('medical_data.csv')
print(df.describe())  # 統計情報
print(df['自費金額'].sum())  # 合計
```

### バックアップ

```bash
# 定期的にバックアップ
cp medical_data.csv backup/medical_data_$(date +%Y%m%d).csv
```

---

## 📞 サポート

問題が解決しない場合:

1. [Issues](https://github.com/TanabeTasuhiko/skills-introduction-to-github/issues)で検索
2. 新しいIssueを作成（エラーメッセージとスクリーンショットを添付）
3. [ドキュメント](./MEDICAL_DATA_EXTRACTOR.md)を再確認

---

## 🎉 次のステップ

実装が完了したら:

1. ✅ 実際の画像でテスト
2. ✅ データ解析ロジックを調整
3. ✅ 自動化スクリプトの作成
4. ✅ 定期実行の設定

お疲れ様でした！
