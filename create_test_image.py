#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""テスト画像の作成"""

from PIL import Image, ImageDraw, ImageFont

def create_test_image():
    """医療費データのテスト画像を生成"""

    # 画像を作成（800x500ピクセル、白背景）
    img = Image.new('RGB', (900, 450), color='white')
    draw = ImageDraw.Draw(img)

    # テキストデータ（実際の医療費データのイメージ）
    text_data = [
        "【支払種別と保険種別ごとの合計】",
        "",
        "支払種別  保険種別      合計件数  点数      医療収益    患者負担金  自費金額  ※",
        "         社保           53    30,137    301,370    19,260      500      0",
        "         公費単独        0         0          0         0        0      0",
        "         国保           12     6,485     64,850    10,790        0      0",
        "         後期高齢者      1       680      6,800       680        0      0",
        "         自費            0         0          0         0        0      0",
        "         労災            0         0          0         0        0      0",
        "         自賠責          0         0          0         0        0      0",
        "         合計           66    37,302    373,020    30,730      500      0",
    ]

    y_position = 40
    for line in text_data:
        # 黒いテキストを描画
        draw.text((30, y_position), line, fill='black')
        y_position += 35

    # 日付付きファイル名で保存
    from datetime import datetime
    date_str = datetime.now().strftime('%Y%m%d')
    output_path = f"{date_str}_sample_medical_data.png"

    img.save(output_path)
    print(f"✓ テスト画像を作成しました: {output_path}")
    print(f"  サイズ: {img.width}x{img.height}px")
    print(f"\nこの画像を使ってOCRをテストできます:")
    print(f"  python3 extract_with_ocr.py {output_path}")

    return output_path

if __name__ == "__main__":
    create_test_image()
