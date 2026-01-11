#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
医療費画像データからOCRでデータを抽出
Extract medical billing data from images using OCR
"""

import csv
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("警告: OCRライブラリがインストールされていません")
    print("インストール方法:")
    print("  pip install pillow pytesseract")
    print("  # Tesseract本体のインストールも必要です")


class MedicalDataExtractor:
    """医療費データ抽出クラス"""

    def __init__(self):
        self.insurance_types = [
            '社保', '公費単独', '国保', '後期高齢者',
            '自費', '労災', '自賠責'
        ]

    def extract_date_from_filename(self, filename: str) -> str:
        """ファイル名から日付を抽出"""
        # YYYYMMDD形式
        pattern1 = r'(\d{4})(\d{2})(\d{2})'
        match = re.search(pattern1, filename)
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

        # YYYY-MM-DD形式
        pattern2 = r'(\d{4})-(\d{2})-(\d{2})'
        match = re.search(pattern2, filename)
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

        # YYYY_MM_DD形式
        pattern3 = r'(\d{4})_(\d{2})_(\d{2})'
        match = re.search(pattern3, filename)
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

        return datetime.now().strftime('%Y-%m-%d')

    def preprocess_image(self, image_path: str) -> Image:
        """画像の前処理"""
        img = Image.open(image_path)

        # グレースケール変換
        img = img.convert('L')

        # コントラスト調整（オプション）
        # from PIL import ImageEnhance
        # enhancer = ImageEnhance.Contrast(img)
        # img = enhancer.enhance(2.0)

        return img

    def extract_text_from_image(self, image_path: str) -> str:
        """画像からテキストを抽出"""
        if not OCR_AVAILABLE:
            raise RuntimeError("OCRライブラリがインストールされていません")

        try:
            # 画像を読み込み・前処理
            img = self.preprocess_image(image_path)

            # OCR実行（日本語+英語）
            text = pytesseract.image_to_string(
                img,
                lang='jpn+eng',  # 日本語と英語を認識
                config='--psm 6'  # ページセグメンテーションモード
            )

            return text

        except Exception as e:
            print(f"エラー: 画像からのテキスト抽出に失敗しました - {e}")
            return ""

    def parse_medical_data(self, text: str) -> List[Dict]:
        """
        抽出したテキストから医療費データを解析

        想定フォーマット:
        支払種別    保険種別         合計件数  点数    医療収益  患者負担金  自費金額  ...
        社保        53  30,137  301,370  19,260  500
        """
        results = []
        lines = text.split('\n')

        for line in lines:
            # 空行をスキップ
            if not line.strip():
                continue

            # 保険種別を検索
            insurance_type = None
            for ins_type in self.insurance_types:
                if ins_type in line:
                    insurance_type = ins_type
                    break

            if not insurance_type:
                continue

            # 自費金額を抽出（最後の方の数値）
            # パターン: カンマ区切りの数値、またはスペース区切りの数値
            numbers = re.findall(r'[\d,]+', line)

            # 自費金額は通常、行の後半に出現
            # 実際のフォーマットに応じて調整が必要
            self_pay_amount = 0

            if numbers:
                # 最後から2番目か3番目あたりを自費金額と仮定
                # （実際のデータ構造に合わせて調整してください）
                try:
                    # カンマを削除して数値に変換
                    for num_str in reversed(numbers):
                        num = int(num_str.replace(',', ''))
                        # 妥当な自費金額の範囲（0-100000円程度）
                        if 0 <= num <= 100000:
                            self_pay_amount = num
                            break
                except ValueError:
                    pass

            results.append({
                '保険種別': insurance_type,
                '自費金額': self_pay_amount
            })

        return results

    def extract_from_image(self, image_path: str) -> List[Dict]:
        """
        画像から保険種別と自費金額を抽出

        Returns:
            [{'日付': '2026-01-11', '保険種別': '社保', '自費金額': 500}, ...]
        """
        filename = Path(image_path).name
        date = self.extract_date_from_filename(filename)

        print(f"\n処理中: {filename}")

        if not OCR_AVAILABLE:
            print("  OCR未使用: サンプルデータを返します")
            # サンプルデータ
            data = [
                {'保険種別': '社保', '自費金額': 500},
                {'保険種別': '国保', '自費金額': 0},
                {'保険種別': '後期高齢者', '自費金額': 0},
            ]
        else:
            # OCRでテキストを抽出
            print("  OCR実行中...")
            text = self.extract_text_from_image(image_path)

            if text:
                print(f"  抽出したテキスト（一部）:\n  {text[:200]}...")
                # データを解析
                data = self.parse_medical_data(text)
                print(f"  {len(data)}件のデータを抽出")
            else:
                print("  警告: テキストを抽出できませんでした")
                data = []

        # 日付を追加
        results = []
        for item in data:
            results.append({
                '日付': date,
                '保険種別': item['保険種別'],
                '自費金額': item['自費金額']
            })

        return results

    def process_images(self, image_paths: List[str], output_csv: str = "medical_data.csv") -> Optional[str]:
        """複数の画像を処理してCSVに出力"""
        all_data = []

        for image_path in image_paths:
            if not Path(image_path).exists():
                print(f"警告: ファイルが見つかりません - {image_path}")
                continue

            try:
                data = self.extract_from_image(image_path)
                all_data.extend(data)
            except Exception as e:
                print(f"エラー: {image_path} の処理中にエラーが発生しました - {e}")
                continue

        if not all_data:
            print("\n抽出できたデータがありません")
            return None

        # CSVに書き込み
        with open(output_csv, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = ['日付', '保険種別', '自費金額']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_data)

        print(f"\n✓ 完了! {len(all_data)}行のデータを '{output_csv}' に保存しました")
        return output_csv


def main():
    """メイン処理"""
    print("=" * 70)
    print("医療費データ抽出ツール (OCR版)")
    print("=" * 70)

    if not OCR_AVAILABLE:
        print("\n⚠️  OCRライブラリがインストールされていません")
        print("\nインストール手順:")
        print("=" * 70)
        print("\n1. Tesseractをインストール:")
        print("   Ubuntu/Debian:")
        print("     sudo apt-get install tesseract-ocr tesseract-ocr-jpn")
        print("\n   macOS:")
        print("     brew install tesseract tesseract-lang")
        print("\n   Windows:")
        print("     https://github.com/UB-Mannheim/tesseract/wiki からインストーラーをダウンロード")
        print("\n2. Pythonパッケージをインストール:")
        print("     pip install pillow pytesseract")
        print("\n" + "=" * 70)
        print("\nサンプルデータモードで続行します...\n")

    # コマンドライン引数から画像ファイルを取得
    if len(sys.argv) < 2:
        print("\n使用方法:")
        print(f"  {sys.argv[0]} <画像ファイル1> [画像ファイル2] ...")
        print("\n例:")
        print(f"  {sys.argv[0]} 20260111_billing.png")
        print(f"  {sys.argv[0]} image1.png image2.png image3.png")
        print(f"  {sys.argv[0]} *.png  # すべてのPNG画像を処理")
        sys.exit(1)

    image_paths = sys.argv[1:]
    output_csv = "medical_data.csv"

    # データ抽出を実行
    extractor = MedicalDataExtractor()
    result = extractor.process_images(image_paths, output_csv)

    if result:
        print(f"\n🎉 成功! スプレッドシートファイルを確認してください:")
        print(f"   📄 {result}")
        print("\nGoogle Sheetsにアップロードする場合:")
        print(f"   python3 upload_to_google_sheets.py {result}")


if __name__ == "__main__":
    main()
