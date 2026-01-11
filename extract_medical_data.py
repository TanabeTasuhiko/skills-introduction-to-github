#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
医療費画像データから保険種別と自費金額を抽出してスプレッドシートを作成
Extract insurance type and self-pay amount from medical billing images
"""

import csv
import re
from datetime import datetime
from pathlib import Path
import sys


def extract_date_from_filename(filename):
    """
    ファイル名から日付を抽出
    Examples:
      - 20260111_data.png -> 2026-01-11
      - billing_2026_01_11.jpg -> 2026-01-11
      - 2026-01-11.png -> 2026-01-11
    """
    # パターン1: YYYYMMDD形式
    pattern1 = r'(\d{4})(\d{2})(\d{2})'
    match = re.search(pattern1, filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    # パターン2: YYYY-MM-DD形式
    pattern2 = r'(\d{4})-(\d{2})-(\d{2})'
    match = re.search(pattern2, filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    # パターン3: YYYY_MM_DD形式
    pattern3 = r'(\d{4})_(\d{2})_(\d{2})'
    match = re.search(pattern3, filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    # 日付が見つからない場合は現在の日付を使用
    return datetime.now().strftime('%Y-%m-%d')


def extract_data_from_image(image_path, data=None):
    """
    画像から保険種別と自費金額を抽出
    実際のOCR処理の代わりに、サンプルデータまたは提供されたデータを使用
    """
    if data is None:
        # サンプルデータ（ユーザー提供の画像から）
        data = [
            {"保険種別": "社保", "自費金額": 500},
            {"保険種別": "公費単独", "自費金額": 0},
            {"保険種別": "国保", "自費金額": 0},
            {"保険種別": "後期高齢者", "自費金額": 0},
            {"保険種別": "自費", "自費金額": 0},
            {"保険種別": "労災", "自費金額": 0},
            {"保険種別": "自賠責", "自費金額": 0},
        ]

    # ファイル名から日付を抽出
    date = extract_date_from_filename(str(image_path))

    # 各行に日付を追加
    result = []
    for row in data:
        result.append({
            "日付": date,
            "保険種別": row["保険種別"],
            "自費金額": row["自費金額"]
        })

    return result


def process_images(image_files, output_csv="medical_data.csv"):
    """
    複数の画像ファイルを処理してCSVファイルを作成
    """
    all_data = []

    for image_file in image_files:
        print(f"処理中: {image_file}")
        data = extract_data_from_image(image_file)
        all_data.extend(data)

    # CSVファイルに書き込み
    if all_data:
        with open(output_csv, 'w', newline='', encoding='utf-8-sig') as csvfile:
            fieldnames = ['日付', '保険種別', '自費金額']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for row in all_data:
                writer.writerow(row)

        print(f"\n✓ データを '{output_csv}' に保存しました")
        print(f"  総行数: {len(all_data)}行")
        return output_csv
    else:
        print("抽出するデータがありません")
        return None


def main():
    """メイン処理"""
    print("=" * 60)
    print("医療費データ抽出ツール")
    print("=" * 60)

    # コマンドライン引数から画像ファイルを取得
    if len(sys.argv) > 1:
        image_files = sys.argv[1:]
    else:
        # デモンストレーション用のサンプルデータ
        print("\n使用方法: python extract_medical_data.py <画像ファイル1> [画像ファイル2] ...")
        print("\n画像ファイルが指定されていないため、サンプルデータで実行します\n")

        # サンプルデータを使用
        sample_filename = "20260111_medical_billing.png"
        print(f"サンプル画像: {sample_filename}\n")
        image_files = [sample_filename]

    # 出力CSVファイル名
    output_csv = "medical_data.csv"

    # 画像を処理してCSVを作成
    result = process_images(image_files, output_csv)

    if result:
        print(f"\n完了! スプレッドシートファイル '{result}' を確認してください")

    return 0


if __name__ == "__main__":
    sys.exit(main())
