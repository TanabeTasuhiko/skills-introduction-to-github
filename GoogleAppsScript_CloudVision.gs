/**
 * 医療費データ抽出 - Google Cloud Vision API版
 * Medical Data Extraction with Cloud Vision API
 *
 * セットアップ:
 * 1. Google Cloud Console でプロジェクトを作成
 * 2. Cloud Vision API を有効化
 * 3. APIキーを取得
 * 4. 下記の API_KEY にAPIキーを設定
 */

// ⚠️ ここにGoogle Cloud Vision APIのAPIキーを設定してください
const API_KEY = 'YOUR_API_KEY_HERE';

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('医療費データ抽出 (OCR)')
    .addItem('📊 画像からデータ抽出 (OCR)', 'extractDataWithOCR')
    .addItem('📁 Driveフォルダから一括抽出 (OCR)', 'extractFromFolderWithOCR')
    .addItem('🔧 API設定', 'showAPISettings')
    .addToUi();
}

/**
 * 単一画像からデータを抽出（OCR使用）
 */
function extractDataWithOCR() {
  const ui = SpreadsheetApp.getUi();

  // ファイルIDの入力を求める
  const response = ui.prompt(
    '画像ファイルを選択',
    'Google DriveにアップロードされているファイルのID、またはURLを入力してください:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const input = response.getResponseText();

  // ファイルIDを抽出
  let fileId = input;
  const fileIdMatch = input.match(/[-\w]{25,}/);
  if (fileIdMatch) {
    fileId = fileIdMatch[0];
  }

  try {
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();

    ui.alert('処理中', `ファイル: ${fileName}\n\nOCR処理を実行しています...`, ui.ButtonSet.OK);

    // OCRでテキストを抽出
    const text = extractTextFromImageFile(file);

    // データを解析
    const data = parseMedicalData(text, fileName);

    // シートに書き込み
    writeDataToSheet(data);

    ui.alert('✅ 完了', `${data.length}行のデータを抽出しました`, ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('❌ エラー', `処理中にエラーが発生しました:\n${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * フォルダから一括抽出（OCR使用）
 */
function extractFromFolderWithOCR() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    '📁 フォルダIDを入力',
    'Google DriveフォルダのURLまたはIDを入力してください:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const input = response.getResponseText();

  let folderId = input;
  const folderIdMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderIdMatch) {
    folderId = folderIdMatch[1];
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    const imageFiles = getImageFiles(folder);

    if (imageFiles.length === 0) {
      ui.alert('情報', 'フォルダ内に画像ファイルが見つかりませんでした', ui.ButtonSet.OK);
      return;
    }

    ui.alert(
      '処理開始',
      `${imageFiles.length}個の画像ファイルを処理します\n\n処理には時間がかかる場合があります...`,
      ui.ButtonSet.OK
    );

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();

    // ヘッダー
    const headers = ['ファイル名', '日付', '保険種別', '自費金額', 'ファイルURL'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    let allData = [];

    // 各画像を処理
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileName = file.getName();

      try {
        // OCR処理
        const text = extractTextFromImageFile(file);
        const data = parseMedicalData(text, fileName);

        // ファイル情報を追加
        data.forEach(row => {
          allData.push([
            fileName,
            row['日付'],
            row['保険種別'],
            row['自費金額'],
            file.getUrl()
          ]);
        });

        // 進捗表示
        Logger.log(`処理完了: ${i + 1}/${imageFiles.length} - ${fileName}`);

      } catch (e) {
        Logger.log(`エラー: ${fileName} - ${e.message}`);
      }
    }

    // データを書き込み
    if (allData.length > 0) {
      sheet.getRange(2, 1, allData.length, headers.length).setValues(allData);
    }

    sheet.autoResizeColumns(1, headers.length);

    ui.alert(
      '✅ 一括抽出完了',
      `${imageFiles.length}個のファイルから ${allData.length}行のデータを抽出しました`,
      ui.ButtonSet.OK
    );

  } catch (e) {
    ui.alert('❌ エラー', `処理中にエラーが発生しました:\n${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * フォルダ内の画像ファイルを取得
 */
function getImageFiles(folder) {
  const files = [];
  const imageTypes = [MimeType.PNG, MimeType.JPEG, MimeType.BMP, MimeType.GIF];

  imageTypes.forEach(mimeType => {
    const fileIterator = folder.getFilesByType(mimeType);
    while (fileIterator.hasNext()) {
      files.push(fileIterator.next());
    }
  });

  return files;
}

/**
 * Google Cloud Vision APIで画像からテキストを抽出
 */
function extractTextFromImageFile(file) {
  if (API_KEY === 'YOUR_API_KEY_HERE' || !API_KEY) {
    throw new Error('APIキーが設定されていません。スクリプトの先頭でAPI_KEYを設定してください。');
  }

  // 画像をBase64エンコード
  const imageBlob = file.getBlob();
  const imageBytes = imageBlob.getBytes();
  const base64Image = Utilities.base64Encode(imageBytes);

  // Cloud Vision API リクエスト
  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

  const payload = {
    requests: [{
      image: {
        content: base64Image
      },
      features: [{
        type: 'TEXT_DETECTION',  // OCR
        maxResults: 1
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(visionUrl, options);
    const json = JSON.parse(response.getContentText());

    if (json.responses && json.responses[0].textAnnotations) {
      return json.responses[0].textAnnotations[0].description;
    } else if (json.responses && json.responses[0].error) {
      throw new Error(`Vision API Error: ${json.responses[0].error.message}`);
    } else {
      return '';
    }

  } catch (e) {
    throw new Error(`OCR処理に失敗しました: ${e.message}`);
  }
}

/**
 * 抽出したテキストから医療費データを解析
 */
function parseMedicalData(text, fileName) {
  const insuranceTypes = ['社保', '公費単独', '国保', '後期高齢者', '自費', '労災', '自賠責'];
  const date = extractDateFromFilename(fileName);
  const results = [];

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 保険種別を検索
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

    // 数値を抽出（カンマ区切りまたはスペース区切り）
    const numbers = line.match(/[\d,]+/g);
    let selfPayAmount = 0;

    if (numbers) {
      // 最後の方の数値を自費金額と仮定
      for (let k = numbers.length - 1; k >= 0; k--) {
        const num = parseInt(numbers[k].replace(/,/g, ''));
        if (num >= 0 && num <= 100000) {
          selfPayAmount = num;
          break;
        }
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

/**
 * ファイル名から日付を抽出
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

  // 今日の日付
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * データをシートに書き込み
 */
function writeDataToSheet(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();

  // ヘッダー
  const headers = ['日付', '保険種別', '自費金額'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // データ
  if (data.length > 0) {
    const values = data.map(row => [row['日付'], row['保険種別'], row['自費金額']]);
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  sheet.autoResizeColumns(1, headers.length);
}

/**
 * API設定を表示
 */
function showAPISettings() {
  const ui = SpreadsheetApp.getUi();

  const message = `
⚙️ Google Cloud Vision API 設定

現在の設定状況:
API_KEY: ${API_KEY === 'YOUR_API_KEY_HERE' ? '❌ 未設定' : '✅ 設定済み'}

セットアップ手順:
1. Google Cloud Console (console.cloud.google.com) を開く
2. プロジェクトを作成
3. 「APIとサービス」→「ライブラリ」を開く
4. 「Cloud Vision API」を検索して有効化
5. 「認証情報」→「認証情報を作成」→「APIキー」
6. 作成されたAPIキーをコピー
7. Apps Scriptエディタで API_KEY を設定
8. 保存して再実行

参考: https://cloud.google.com/vision/docs/setup

注意:
- Cloud Vision APIは従量課金制です
- 無料枠: 月1,000リクエストまで
- 料金: https://cloud.google.com/vision/pricing
`;

  ui.alert('API設定', message, ui.ButtonSet.OK);
}
