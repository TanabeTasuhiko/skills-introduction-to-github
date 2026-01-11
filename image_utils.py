#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
画像処理ユーティリティ
Image processing utilities for better OCR results
"""

try:
    from PIL import Image, ImageEnhance, ImageFilter
    import numpy as np
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


class ImagePreprocessor:
    """画像前処理クラス - OCR精度を向上させる"""

    @staticmethod
    def enhance_image(image_path: str, output_path: str = None) -> Image:
        """
        画像を前処理してOCR精度を向上

        処理内容:
        1. グレースケール化
        2. コントラスト強調
        3. シャープネス調整
        4. ノイズ除去
        """
        if not PIL_AVAILABLE:
            raise RuntimeError("PILライブラリが必要です: pip install pillow")

        # 画像を開く
        img = Image.open(image_path)

        # 1. グレースケール化
        img = img.convert('L')

        # 2. コントラスト強調
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)  # コントラストを2倍に

        # 3. シャープネス調整
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5)  # シャープネスを1.5倍に

        # 4. ノイズ除去
        img = img.filter(ImageFilter.MedianFilter(size=3))

        # 保存（オプション）
        if output_path:
            img.save(output_path)
            print(f"前処理済み画像を保存: {output_path}")

        return img

    @staticmethod
    def binarize_image(image_path: str, threshold: int = 128) -> Image:
        """
        画像を二値化（白黒化）

        Args:
            image_path: 入力画像パス
            threshold: 二値化の閾値 (0-255)
        """
        if not PIL_AVAILABLE:
            raise RuntimeError("PILライブラリが必要です")

        img = Image.open(image_path).convert('L')

        # 二値化
        img = img.point(lambda x: 255 if x > threshold else 0)

        return img

    @staticmethod
    def crop_table_area(image_path: str, crop_box: tuple = None) -> Image:
        """
        画像から表の部分だけを切り出し

        Args:
            image_path: 入力画像パス
            crop_box: (left, top, right, bottom) のタプル
        """
        img = Image.open(image_path)

        if crop_box:
            img = img.crop(crop_box)
        else:
            # デフォルト: 画像の中央60%を切り出し
            width, height = img.size
            left = width * 0.2
            top = height * 0.2
            right = width * 0.8
            bottom = height * 0.8
            img = img.crop((left, top, right, bottom))

        return img

    @staticmethod
    def rotate_image(image_path: str, angle: float = 0) -> Image:
        """画像を回転（傾き補正）"""
        img = Image.open(image_path)
        return img.rotate(angle, expand=True, fillcolor='white')

    @staticmethod
    def resize_image(image_path: str, scale: float = 2.0) -> Image:
        """
        画像をリサイズ（拡大するとOCR精度が向上する場合がある）

        Args:
            scale: スケール倍率（2.0 = 2倍に拡大）
        """
        img = Image.open(image_path)
        new_size = (int(img.width * scale), int(img.height * scale))
        return img.resize(new_size, Image.Resampling.LANCZOS)


def create_test_image():
    """
    テスト用の医療費データ画像を生成

    実際の使用時はこの関数は不要です
    """
    if not PIL_AVAILABLE:
        print("PILが必要です")
        return

    from PIL import ImageDraw, ImageFont

    # 画像を作成
    img = Image.new('RGB', (800, 400), color='white')
    draw = ImageDraw.Draw(img)

    # テキストを描画（実際の医療費データのイメージ）
    text_data = [
        "【支払種別と保険種別ごとの合計】",
        "",
        "支払種別  保険種別      合計件数  点数    医療収益  患者負担金  自費金額",
        "         社保           53    30,137  301,370   19,260      500",
        "         公費単独        0         0        0        0        0",
        "         国保           12     6,485   64,850   10,790        0",
        "         後期高齢者      1       680    6,800      680        0",
        "         自費            0         0        0        0        0",
        "         労災            0         0        0        0        0",
        "         自賠責          0         0        0        0        0",
        "         合計           66    37,302  373,020   30,730      500",
    ]

    y_position = 30
    for line in text_data:
        draw.text((20, y_position), line, fill='black')
        y_position += 30

    # 保存
    output_path = "sample_medical_data.png"
    img.save(output_path)
    print(f"テスト画像を作成しました: {output_path}")
    return output_path


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("使用方法:")
        print(f"  {sys.argv[0]} <画像ファイル> [出力ファイル]")
        print("\n例:")
        print(f"  {sys.argv[0]} input.png output_enhanced.png")
        print("\nまたは、テスト画像を生成:")
        print(f"  {sys.argv[0]} --create-test")
        sys.exit(1)

    if sys.argv[1] == '--create-test':
        create_test_image()
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else "enhanced_" + input_path

        preprocessor = ImagePreprocessor()
        img = preprocessor.enhance_image(input_path, output_path)
        print(f"✓ 画像を前処理しました: {output_path}")
