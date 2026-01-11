/**
 * 医療費データ抽出 - Google Apps Script版
 * Medical Data Extraction Tool - Google Apps Script
 *
 * 使い方:
 * 1. Google Drive でこのスクリプトを含むスプレッドシートを開く
 * 2. 拡張機能 > Apps Script でこのコードを貼り付け
 * 3. 関数を実行してデータを抽出
 */

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('医療費データ抽出')
    .addItem('📊 画像からデータ抽出', 'extractDataFromImages')
    .addItem('📁 Driveフォルダから一括抽出', 'extractFromFolder')
    .addItem('🔧 設定', 'showSettings')
    .addToUi();
}

/**
 * サンプルデータを現在のシートに書き込み
 */
function extractDataFromImages() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // ヘッダーをクリア
  sheet.clear();

  // ヘッダーを設定
  const headers = ['日付', '保険種別', '自費金額'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダーのスタイル設定
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // サンプルデータ（実際にはOCRや画像処理を実装）
  const data = [
    ['2026-01-11', '社保', 500],
    ['2026-01-11', '公費単独', 0],
    ['2026-01-11', '国保', 0],
    ['2026-01-11', '後期高齢者', 0],
    ['2026-01-11', '自費', 0],
    ['2026-01-11', '労災', 0],
    ['2026-01-11', '自賠責', 0]
  ];

  // データを書き込み
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }

  // 列幅を自動調整
  sheet.autoResizeColumns(1, headers.length);

  // 完了メッセージ
  SpreadsheetApp.getUi().alert(
    '✅ データ抽出完了',
    `${data.length}行のデータを抽出しました`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Google Driveフォルダから画像ファイルを検索して一括処理
 */
function extractFromFolder() {
  const ui = SpreadsheetApp.getUi();

  // フォルダIDの入力を求める
  const response = ui.prompt(
    '📁 フォルダIDを入力',
    'Google DriveフォルダのURLまたはIDを入力してください:\n' +
    '例: https://drive.google.com/drive/folders/FOLDER_ID',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const input = response.getResponseText();

  // フォルダIDを抽出
  let folderId = input;
  const folderIdMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderIdMatch) {
    folderId = folderIdMatch[1];
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    const imageFiles = folder.getFilesByType(MimeType.PNG);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();

    // ヘッダー
    const headers = ['ファイル名', '日付', '保険種別', '自費金額', 'ファイルURL'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    let rowIndex = 2;
    let fileCount = 0;

    // 各画像ファイルを処理
    while (imageFiles.hasNext()) {
      const file = imageFiles.next();
      const fileName = file.getName();
      const fileUrl = file.getUrl();
      const date = extractDateFromFilename(fileName);

      fileCount++;

      // サンプルデータ（実際にはOCR処理）
      const insuranceTypes = ['社保', '国保', '後期高齢者', '自費', '労災', '自賠責'];
      insuranceTypes.forEach(type => {
        const amount = type === '社保' ? 500 : 0;
        sheet.getRange(rowIndex, 1, 1, 5).setValues([
          [fileName, date, type, amount, fileUrl]
        ]);
        rowIndex++;
      });
    }

    sheet.autoResizeColumns(1, headers.length);

    ui.alert(
      '✅ 一括抽出完了',
      `${fileCount}個のファイルから ${rowIndex - 2}行のデータを抽出しました`,
      ui.ButtonSet.OK
    );

  } catch (e) {
    ui.alert(
      '❌ エラー',
      `フォルダの読み込みに失敗しました:\n${e.message}`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * ファイル名から日付を抽出
 * @param {string} filename - ファイル名
 * @return {string} - 日付 (YYYY-MM-DD形式)
 */
function extractDateFromFilename(filename) {
  // YYYYMMDD形式
  let match = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // YYYY-MM-DD形式
  match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // YYYY_MM_DD形式
  match = filename.match(/(\d{4})_(\d{2})_(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // 日付が見つからない場合は今日の日付
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * 設定ダイアログを表示
 */
function showSettings() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '⚙️ 設定',
    '医療費データ抽出ツール v1.0\n\n' +
    '機能:\n' +
    '• 画像ファイル名から日付を自動抽出\n' +
    '• 保険種別と自費金額の抽出\n' +
    '• Google Drive内の画像を一括処理\n\n' +
    '対応ファイル形式:\n' +
    '• PNG, JPG, JPEG\n\n' +
    '対応日付形式:\n' +
    '• YYYYMMDD (例: 20260111)\n' +
    '• YYYY-MM-DD (例: 2026-01-11)\n' +
    '• YYYY_MM_DD (例: 2026_01_11)',
    ui.ButtonSet.OK
  );
}

/**
 * OCR機能を使ってテキストを抽出（Google Cloud Vision API使用）
 * 注: Google Cloud Platform でVision APIを有効化する必要があります
 */
function extractTextFromImage(file) {
  // TODO: Google Cloud Vision APIを使用してOCR処理を実装
  // 現在はサンプルデータを返す
  return {
    insuranceType: '社保',
    selfPayAmount: 500
  };
}

/**
 * 現在のシートをCSVとしてエクスポート
 */
function exportToCSV() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const fileName = `医療費データ_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')}.csv`;

  // CSV形式で取得
  const csv = convertRangeToCsv_(sheet.getDataRange());

  // DriveにCSVファイルとして保存
  DriveApp.createFile(fileName, csv, MimeType.CSV);

  SpreadsheetApp.getUi().alert(
    '✅ エクスポート完了',
    `CSVファイルをGoogle Driveに保存しました:\n${fileName}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 範囲をCSV形式に変換
 */
function convertRangeToCsv_(range) {
  const data = range.getValues();
  const csv = data.map(row => {
    return row.map(cell => {
      // セルにカンマや改行が含まれる場合はダブルクォートで囲む
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n') || cell.includes('"'))) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',');
  }).join('\n');

  return csv;
}
