#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Sheetsへの自動アップロード機能
Upload medical data CSV to Google Sheets
"""

import csv
import os
import sys
from pathlib import Path

try:
    from google.oauth2.credentials import Credentials
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False


def read_csv_data(csv_file):
    """CSVファイルを読み込んでリスト形式で返す"""
    data = []
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        for row in reader:
            data.append(row)
    return data


def upload_to_google_sheets(csv_file, spreadsheet_name=None, credentials_file=None):
    """
    CSVデータをGoogle Sheetsにアップロード

    Args:
        csv_file: アップロードするCSVファイルのパス
        spreadsheet_name: 作成するスプレッドシートの名前
        credentials_file: Google API認証情報ファイルのパス

    Returns:
        スプレッドシートのURL
    """
    if not GOOGLE_API_AVAILABLE:
        print("エラー: Google APIライブラリがインストールされていません")
        print("以下のコマンドでインストールしてください:")
        print("  pip install --upgrade google-api-python-client google-auth-httplib2 google-auth-oauthlib")
        return None

    # デフォルトのスプレッドシート名
    if spreadsheet_name is None:
        spreadsheet_name = f"医療費データ_{Path(csv_file).stem}"

    # 認証情報ファイルのパス
    if credentials_file is None:
        credentials_file = "credentials.json"

    # 認証情報の確認
    if not os.path.exists(credentials_file):
        print(f"エラー: 認証情報ファイル '{credentials_file}' が見つかりません")
        print("\nGoogle Sheets APIを使用するには:")
        print("1. Google Cloud Consoleでプロジェクトを作成")
        print("2. Google Sheets APIを有効化")
        print("3. サービスアカウントを作成し、JSONキーをダウンロード")
        print("4. ダウンロードしたファイルを 'credentials.json' として保存")
        print("\n詳細: https://developers.google.com/sheets/api/quickstart/python")
        return None

    try:
        # サービスアカウント認証
        creds = service_account.Credentials.from_service_account_file(
            credentials_file,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )

        # Google Sheets API service
        service = build('sheets', 'v4', credentials=creds)

        # 新しいスプレッドシートを作成
        spreadsheet = {
            'properties': {
                'title': spreadsheet_name
            }
        }
        spreadsheet = service.spreadsheets().create(
            body=spreadsheet,
            fields='spreadsheetId,spreadsheetUrl'
        ).execute()

        spreadsheet_id = spreadsheet.get('spreadsheetId')
        spreadsheet_url = spreadsheet.get('spreadsheetUrl')

        print(f"✓ スプレッドシートを作成しました: {spreadsheet_name}")
        print(f"  ID: {spreadsheet_id}")

        # CSVデータを読み込み
        data = read_csv_data(csv_file)

        # データを書き込み
        body = {
            'values': data
        }
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range='A1',
            valueInputOption='RAW',
            body=body
        ).execute()

        print(f"✓ データを書き込みました: {len(data)}行")
        print(f"\n🔗 スプレッドシートURL:")
        print(f"   {spreadsheet_url}")

        return spreadsheet_url

    except HttpError as error:
        print(f"エラーが発生しました: {error}")
        return None
    except Exception as e:
        print(f"予期しないエラー: {e}")
        return None


def upload_to_google_drive_simple(csv_file):
    """
    簡易版: CSVファイルをGoogle Driveの共有リンク形式で案内
    """
    print("=" * 60)
    print("Google Driveへのアップロード方法")
    print("=" * 60)
    print(f"\n生成されたCSVファイル: {csv_file}\n")

    print("【方法1】手動アップロード（推奨・最も簡単）")
    print("-" * 60)
    print("1. Google Drive (https://drive.google.com) を開く")
    print(f"2. '{csv_file}' をドラッグ&ドロップでアップロード")
    print("3. アップロードしたファイルを右クリック")
    print("4. 「アプリで開く」→「Google スプレッドシート」を選択")
    print("   ※自動的にスプレッドシートに変換されます")

    print("\n【方法2】Google Sheets APIで自動アップロード")
    print("-" * 60)
    print("以下のコマンドでAPIを使った自動アップロード:")
    print(f"  python3 {__file__} {csv_file} --auto")
    print("\n前提条件:")
    print("  - Google Cloud Consoleでプロジェクトを作成済み")
    print("  - Google Sheets API有効化済み")
    print("  - credentials.json が準備済み")

    print("\n【方法3】Google Driveデスクトップアプリ")
    print("-" * 60)
    print("1. Google Driveデスクトップアプリをインストール")
    print("2. 同期フォルダにCSVファイルをコピー")
    print("3. 自動的にGoogle Driveにアップロードされます")

    print("\n" + "=" * 60)


def main():
    """メイン処理"""
    if len(sys.argv) < 2:
        print("使用方法:")
        print(f"  {sys.argv[0]} <CSVファイル> [--auto]")
        print("\nオプション:")
        print("  --auto  : Google Sheets APIで自動アップロード")
        print("\n例:")
        print(f"  {sys.argv[0]} medical_data.csv")
        print(f"  {sys.argv[0]} medical_data.csv --auto")
        sys.exit(1)

    csv_file = sys.argv[1]

    if not os.path.exists(csv_file):
        print(f"エラー: ファイル '{csv_file}' が見つかりません")
        sys.exit(1)

    # 自動アップロードモード
    if len(sys.argv) > 2 and sys.argv[2] == '--auto':
        print("Google Sheets APIを使用して自動アップロードします...\n")
        url = upload_to_google_sheets(csv_file)
        if url:
            print("\n✅ アップロード完了!")
        else:
            print("\n❌ アップロードに失敗しました")
            print("手動アップロード方法を表示します:\n")
            upload_to_google_drive_simple(csv_file)
    else:
        # 簡易案内モード
        upload_to_google_drive_simple(csv_file)


if __name__ == "__main__":
    main()
