/**
 * 納税アナウンス自動通知システム
 * =====================================================================
 * 管理項目:
 *   ① 源泉所得税(納期特例 7/10・1/20 / 毎月納付 翌月10日) … 顧客マスタから自動計算
 *   ② 本決算(申告・納付期限 = 決算月末の2ヶ月後)          … 顧客マスタから自動計算
 *   ③ 予定納税・中間申告(法人税・消費税・所得税)           … 「予定納税一覧」シートが正本
 *   ④ 事前確定届出給与の支給日                              … 「事前確定給与」シートが正本
 *
 * 使い方(詳細は gas/README.md):
 *   1. スプレッドシートの 拡張機能 > Apps Script にこのファイルを貼り付けて保存
 *   2. メニュー「📮 納税通知」>「① 初期セットアップ」でシートを自動作成
 *   3. 顧客マスタを入力 →「② 予定納税一覧を自動生成」で期限行を作成し金額を入力
 *   4. 設定シートの送信モード=テスト で「④ 今すぐチェック実行」で動作確認
 *   5. 「⑤ 毎朝7時の自動実行を設定」→ 送信モードを 本番 に変更
 * =====================================================================
 */

const SHEET = {
  master:  '顧客マスタ',
  interim: '予定納税一覧',
  bonus:   '事前確定給与',
  log:     '通知ログ',
  settings:'設定',
  preview: '期限プレビュー',
};

const HOLIDAY_CAL_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

// ============================== メニュー ==============================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📮 納税通知')
    .addItem('① 初期セットアップ(シート作成)', 'initSheets')
    .addItem('② 予定納税一覧を自動生成', 'generateInterimRows')
    .addItem('③ 今後60日の期限プレビュー', 'previewUpcoming')
    .addItem('④ 今すぐチェック実行(通知送信)', 'dailyCheck')
    .addItem('⑤ 毎朝7時の自動実行を設定', 'createDailyTrigger')
    .addToUi();
}

// ============================== 共通ユーティリティ ==============================

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function fmt(d) { return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd'); }

function fmtJp(d) {
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy年M月d日') + '(' + w + ')';
}

function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

/** 人間の月表記(1-12)で m 月の末日 */
function lastDayOfMonth(y, m) { return new Date(y, m, 0); }

/** y年m月(1-12) の add ヶ月後の月末日 */
function monthEndAfter(y, m, add) {
  const total = m + add;
  const yy = y + Math.floor((total - 1) / 12);
  const mm = ((total - 1) % 12) + 1;
  return lastDayOfMonth(yy, mm);
}

/** セル値を日付(0時)に正規化。無効なら null */
function toDate(v) {
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v); d.setHours(0, 0, 0, 0); return d; }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim().replace(/-/g, '/'));
    if (!isNaN(d)) { d.setHours(0, 0, 0, 0); return d; }
  }
  return null;
}

/** 土日・日本の祝日なら翌営業日に繰り下げ */
function adjustBizDay(d) {
  let cal = null;
  try { cal = CalendarApp.getCalendarById(HOLIDAY_CAL_ID); } catch (e) { /* 権限なしは土日のみで判定 */ }
  const x = new Date(d);
  for (let i = 0; i < 15; i++) {
    const dow = x.getDay();
    let isHoliday = false;
    if (cal) { try { isHoliday = cal.getEventsForDay(x).length > 0; } catch (e) { isHoliday = false; } }
    if (dow !== 0 && dow !== 6 && !isHoliday) return x;
    x.setDate(x.getDate() + 1);
  }
  return x;
}

/** シートをヘッダー行キーのオブジェクト配列として読む */
function readSheetObjects(name) {
  const sh = ss().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0].map(String);
  return values.slice(1)
    .filter(row => row.some(v => v !== '' && v !== null))
    .map(row => {
      const o = {};
      header.forEach((h, i) => { o[h] = row[i]; });
      return o;
    });
}

/** 設定シートを {キー: 値} で読む */
function getSettings() {
  const o = {};
  readSheetObjects(SHEET.settings).forEach(r => { o[String(r['キー']).trim()] = r['値']; });
  return o;
}

function getTimings(s, key, fallback) {
  const raw = s[key] !== undefined && s[key] !== '' ? String(s[key]) : fallback;
  return raw.split(/[,、\s]+/).map(Number).filter(n => !isNaN(n) && n >= 0);
}

function yen(v) {
  const n = Number(v);
  return isNaN(n) || v === '' || v === null ? '' : n.toLocaleString('ja-JP') + '円';
}

// ============================== ① 初期セットアップ ==============================

function initSheets() {
  const book = ss();
  const me = Session.getActiveUser().getEmail() || '';

  const defs = [
    { name: SHEET.master,
      header: ['顧客ID', '会社名', '種別(法人/個人)', '決算月(1-12)', '申告期限延長(あり/なし)',
               '源泉所得税(納期特例/毎月/対象外)', '中間・予定納税(あり/なし)', '消費税中間回数(0/1/3/11)',
               '通知先メール', '通知先氏名', '顧客区分', '有効(有効/停止)', '備考'],
      sample: [['C001', '株式会社サンプル商事', '法人', 3, 'なし', '納期特例', 'あり', 1,
                'sample@example.com', '山田 太郎', '一般', '有効', 'サンプル行(削除可)']] },
    { name: SHEET.interim,
      header: ['顧客ID', '会社名', '税目', '期限日', '金額', '納付方法', 'ステータス(未納付/納付済/対象外)', '備考'],
      sample: [['C001', '株式会社サンプル商事', '法人税・地方税 中間', '2026/11/30', 500000, 'ダイレクト納付', '未納付', 'サンプル行(削除可)']] },
    { name: SHEET.bonus,
      header: ['顧客ID', '会社名', '支給対象者', '支給予定日', '支給額', '届出提出日', 'ステータス(予定/支給済)', '備考'],
      sample: [['C001', '株式会社サンプル商事', '代表取締役 山田太郎', '2026/12/25', 3000000, '2026/06/20', '予定', 'サンプル行(削除可)']] },
    { name: SHEET.log,
      header: ['送信日時', '顧客ID', '会社名', '税目', '期限日', '通知種別', '送信先', '結果'],
      sample: [] },
    { name: SHEET.settings,
      header: ['キー', '値', '説明'],
      sample: [
        ['事務所名', '○○会計事務所', 'メール本文・署名に使用'],
        ['差出人表示名', '○○会計事務所', 'メールの差出人名'],
        ['返信先メール', me, '顧客が返信したときの宛先'],
        ['CCメール', '', '全通知をCCする事務所内アドレス(任意)'],
        ['管理者メール', me, 'テスト送信・日次サマリー・エラーの宛先'],
        ['送信モード', 'テスト', 'テスト=管理者にのみ送信 / 本番=顧客に送信'],
        ['通知タイミング(日前)', '30,7,1', '期限の何日前に通知するか(カンマ区切り)'],
        ['決算の事前通知日数', '60', '本決算のみ、この日数前にも資料準備の案内を送る'],
      ] },
  ];

  defs.forEach(def => {
    let sh = book.getSheetByName(def.name);
    if (!sh) sh = book.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, def.header.length).setValues([def.header])
        .setFontWeight('bold').setBackground('#e8f5ee');
      sh.setFrozenRows(1);
      if (def.sample.length) sh.getRange(2, 1, def.sample.length, def.sample[0].length).setValues(def.sample);
      sh.autoResizeColumns(1, def.header.length);
    }
  });

  SpreadsheetApp.getUi().alert(
    'シートを作成しました。\n\n' +
    '1) 「顧客マスタ」に顧問先を入力\n' +
    '2) メニュー「② 予定納税一覧を自動生成」→ 金額を入力\n' +
    '3) 「事前確定給与」に届出内容を転記\n' +
    '4) 「設定」の管理者メールを確認し、④でテスト送信'
  );
}

// ============================== 通知イベントの収集 ==============================
// イベント = {id, company, email, contact, type, due(営業日調整済), timings(省略時は既定), important, detail, statusNote}

function collectEvents(s) {
  const events = [];
  const warnings = [];
  const horizon = 70;
  const t0 = today0();
  const master = readSheetObjects(SHEET.master).filter(c => String(c['有効(有効/停止)']) !== '停止' && c['会社名']);
  const byId = {};
  master.forEach(c => { byId[String(c['顧客ID']).trim()] = c; });

  const inHorizon = d => { const n = daysBetween(t0, d); return n >= 0 && n <= horizon; };
  const ty = t0.getFullYear();

  // ---- ① 源泉所得税(顧客マスタから自動計算) ----
  master.forEach(c => {
    const mode = String(c['源泉所得税(納期特例/毎月/対象外)'] || '').trim();
    const base = { id: c['顧客ID'], company: c['会社名'], email: c['通知先メール'], contact: c['通知先氏名'] };
    if (mode === '納期特例') {
      [ { d: new Date(ty, 6, 10),     period: '1月〜6月支給分' },
        { d: new Date(ty + 1, 0, 20), period: ty + '年7月〜12月支給分' },
        { d: new Date(ty, 0, 20),     period: (ty - 1) + '年7月〜12月支給分' } ].forEach(x => {
        const due = adjustBizDay(x.d);
        if (inHorizon(due)) events.push(Object.assign({}, base, {
          type: '源泉所得税(納期の特例)', due: due, important: true,
          detail: '対象期間:' + x.period + '\n給与・報酬から預かった源泉所得税の納付期限です。',
        }));
      });
    } else if (mode === '毎月') {
      for (let k = 0; k <= 2; k++) {
        const m = new Date(ty, t0.getMonth() + k, 10);
        const due = adjustBizDay(m);
        if (inHorizon(due)) {
          const prev = new Date(m.getFullYear(), m.getMonth() - 1, 1);
          events.push(Object.assign({}, base, {
            type: '源泉所得税(毎月納付)', due: due, important: true, timingsKey: 'monthly',
            detail: '対象期間:' + Utilities.formatDate(prev, 'Asia/Tokyo', 'yyyy年M月') + '支給分',
          }));
        }
      }
    }
  });

  // ---- ② 本決算(顧客マスタから自動計算・月末決算前提) ----
  const kessanLead = Number(s['決算の事前通知日数'] || 60);
  master.filter(c => String(c['種別(法人/個人)']).trim() === '法人').forEach(c => {
    const fm = Number(c['決算月(1-12)']);
    if (!fm || fm < 1 || fm > 12) return;
    const ext = String(c['申告期限延長(あり/なし)'] || '').trim() === 'あり';
    for (let y = ty - 1; y <= ty + 1; y++) {
      const closing = lastDayOfMonth(y, fm);
      const due = adjustBizDay(monthEndAfter(y, fm, ext ? 3 : 2));
      if (!inHorizon(due)) continue;
      let detail = '決算日:' + fmtJp(closing) + '\n法人税・地方税・消費税の申告および納付の期限です。\n決算資料のご準備・ご提出をお願いいたします。';
      if (ext) detail += '\n※ 申告期限延長法人のため申告は3ヶ月以内ですが、納付は決算後2ヶ月以内の見込納付をご検討ください。';
      events.push({
        id: c['顧客ID'], company: c['会社名'], email: c['通知先メール'], contact: c['通知先氏名'],
        type: '本決算(申告・納付)', due: due, important: true, timingsKey: 'kessan', kessanLead: kessanLead,
        detail: detail,
      });
    }
  });

  // ---- ③ 予定納税・中間申告(「予定納税一覧」シートが正本) ----
  readSheetObjects(SHEET.interim).forEach(r => {
    if (String(r['ステータス(未納付/納付済/対象外)']).trim() !== '未納付') return;
    const due = toDate(r['期限日']);
    if (!due || !inHorizon(due)) return;
    const c = byId[String(r['顧客ID']).trim()] || {};
    const amount = yen(r['金額']);
    events.push({
      id: r['顧客ID'], company: r['会社名'] || c['会社名'],
      email: c['通知先メール'], contact: c['通知先氏名'],
      type: r['税目'] || '予定納税・中間申告', due: due, important: true,
      detail: '納付額:' + (amount || '別途ご案内いたします') +
              (r['納付方法'] ? '\n納付方法:' + r['納付方法'] : '') +
              '\n※ 納付がお済みの場合は行き違いをご容赦ください。',
    });
    if (!c['通知先メール']) warnings.push('予定納税一覧:顧客ID ' + r['顧客ID'] + '(' + (r['会社名'] || '') + ')のメールが顧客マスタにありません');
  });

  // ---- ④ 事前確定届出給与 ----
  readSheetObjects(SHEET.bonus).forEach(r => {
    if (String(r['ステータス(予定/支給済)']).trim() !== '予定') return;
    const due = toDate(r['支給予定日']);
    if (!due || !inHorizon(due)) return;
    const c = byId[String(r['顧客ID']).trim()] || {};
    events.push({
      id: r['顧客ID'], company: r['会社名'] || c['会社名'],
      email: c['通知先メール'], contact: c['通知先氏名'],
      type: '事前確定届出給与の支給', due: due, important: true,
      detail: '支給対象者:' + (r['支給対象者'] || '') +
              '\n支給額:' + (yen(r['支給額']) || '届出書をご確認ください') +
              '\n\n【重要】届出した支給日・支給額と1日・1円でも異なると、原則として全額が損金不算入となります。\n必ず届出内容どおりの日付・金額でお振込みください。',
    });
    if (!c['通知先メール']) warnings.push('事前確定給与:顧客ID ' + r['顧客ID'] + '(' + (r['会社名'] || '') + ')のメールが顧客マスタにありません');
  });

  return { events: events, warnings: warnings };
}

// ============================== ④ 日次チェック(メイン処理) ==============================

function dailyCheck() {
  const s = getSettings();
  const t0 = today0();
  const defaultTimings = getTimings(s, '通知タイミング(日前)', '30,7,1');
  const testMode = String(s['送信モード']).trim() !== '本番';
  const admin = String(s['管理者メール'] || '').trim();

  const { events, warnings } = collectEvents(s);
  const sentKeys = getSentKeys();
  const sent = [];
  const errors = warnings.slice();

  events.forEach(ev => {
    const days = daysBetween(t0, ev.due);
    let timings = defaultTimings;
    if (ev.timingsKey === 'monthly') timings = defaultTimings.filter(n => n <= 7);           // 毎月納付は7日前以内のみ
    if (ev.timingsKey === 'kessan')  timings = defaultTimings.concat([ev.kessanLead]);        // 本決算は事前案内を追加
    if (timings.indexOf(days) === -1) return;

    const key = [ev.id, ev.type, fmt(ev.due), days].join('|');
    if (sentKeys.has(key)) return;

    if (!ev.email) {
      errors.push('メール未登録のため未送信:' + ev.company + ' / ' + ev.type + '(期限 ' + fmt(ev.due) + ')');
      appendLog(ev, days, '-', 'スキップ(メール未登録)');
      sentKeys.add(key);
      return;
    }

    try {
      sendNotification(ev, days, s, testMode, admin);
      appendLog(ev, days, testMode ? admin + '(テスト)' : ev.email, '送信済');
      sentKeys.add(key);
      sent.push(days + '日前|' + ev.company + '|' + ev.type + '|期限 ' + fmt(ev.due));
    } catch (e) {
      errors.push('送信エラー:' + ev.company + ' / ' + ev.type + ' → ' + e.message);
      appendLog(ev, days, ev.email, 'エラー:' + e.message);
    }
  });

  if (admin && (sent.length || errors.length)) {
    MailApp.sendEmail({
      to: admin,
      subject: '【納税通知システム】本日の実行結果 ' + fmt(t0) + (testMode ? '(テストモード)' : ''),
      body: '■ 送信 ' + sent.length + ' 件\n' + (sent.join('\n') || 'なし') +
            '\n\n■ 警告・エラー ' + errors.length + ' 件\n' + (errors.join('\n') || 'なし') +
            '\n\n(このメールは自動送信です)',
    });
  }
}

function sendNotification(ev, days, s, testMode, admin) {
  const office = s['事務所名'] || '会計事務所';
  const dueText = fmtJp(ev.due) + (days === 0 ? '【本日】' : '(' + days + '日後)');
  const subject = (ev.important ? '【重要】' : '') +
    (days === 0 ? '【本日期限】' : '【期限' + days + '日前】') +
    ev.type + 'のお知らせ|' + ev.company;

  const body =
    (ev.contact ? ev.contact + ' 様\n' : '') + ev.company + ' ご担当者様\n\n' +
    'いつもお世話になっております。' + office + 'です。\n' +
    '下記の期限が近づいておりますのでお知らせいたします。\n\n' +
    '──────────────────────\n' +
    '■ 項目:' + ev.type + '\n' +
    '■ 期限:' + dueText + '\n' +
    ev.detail + '\n' +
    '──────────────────────\n\n' +
    'ダイレクト納付・振替納税をご利用の場合は残高のご確認をお願いいたします。\n' +
    'ご不明な点はこのメールにご返信ください。\n\n' +
    office;

  const opt = { name: s['差出人表示名'] || office };
  if (s['返信先メール']) opt.replyTo = String(s['返信先メール']);
  if (s['CCメール'] && !testMode) opt.cc = String(s['CCメール']);

  if (testMode) {
    if (!admin) throw new Error('テストモードですが管理者メールが未設定です');
    opt.to = admin;
    opt.subject = '【テスト】' + subject;
    opt.body = '※テストモード(本来の宛先:' + ev.email + ')\n\n' + body;
  } else {
    opt.to = String(ev.email);
    opt.subject = subject;
    opt.body = body;
  }
  MailApp.sendEmail(opt);
}

// ============================== 通知ログ(重複防止) ==============================

function getSentKeys() {
  const set = new Set();
  readSheetObjects(SHEET.log).forEach(r => {
    const due = toDate(r['期限日']);
    if (!due) return;
    set.add([r['顧客ID'], r['税目'], fmt(due), Number(r['通知種別'])].join('|'));
  });
  return set;
}

function appendLog(ev, days, to, result) {
  const sh = ss().getSheetByName(SHEET.log);
  sh.appendRow([new Date(), ev.id, ev.company, ev.type, fmt(ev.due), days, to, result]);
}

// ============================== ② 予定納税一覧の自動生成 ==============================
// 顧客マスタの「中間・予定納税」「消費税中間回数」「決算月」から、今後12ヶ月分の期限行を生成する。
// 金額は生成後に前期申告書から手入力する(生成済みの同一行はスキップ)。

function generateInterimRows() {
  const t0 = today0();
  const ty = t0.getFullYear();
  const limit = new Date(t0); limit.setDate(limit.getDate() + 370);
  const sh = ss().getSheetByName(SHEET.interim);
  const master = readSheetObjects(SHEET.master).filter(c => String(c['有効(有効/停止)']) !== '停止' && c['会社名']);

  const existing = new Set();
  readSheetObjects(SHEET.interim).forEach(r => {
    const d = toDate(r['期限日']);
    if (d) existing.add([String(r['顧客ID']).trim(), String(r['税目']).trim(), fmt(d)].join('|'));
  });

  const rows = [];
  const manual = [];
  const push = (c, taxName, due) => {
    const adj = adjustBizDay(due);
    if (adj < t0 || adj > limit) return;
    const key = [String(c['顧客ID']).trim(), taxName, fmt(adj)].join('|');
    if (existing.has(key)) return;
    existing.add(key);
    rows.push([c['顧客ID'], c['会社名'], taxName, fmt(adj), '', 'ダイレクト納付', '未納付', '自動生成 ' + fmt(t0) + '(金額を入力してください)']);
  };

  master.forEach(c => {
    if (String(c['中間・予定納税(あり/なし)'] || '').trim() !== 'あり') return;
    const kind = String(c['種別(法人/個人)'] || '').trim();

    if (kind === '個人') {
      for (let y = ty; y <= ty + 1; y++) {
        push(c, '所得税 予定納税(第1期)', new Date(y, 6, 31));
        push(c, '所得税 予定納税(第2期)', new Date(y, 10, 30));
      }
      return;
    }

    const fm = Number(c['決算月(1-12)']);
    if (!fm || fm < 1 || fm > 12) return;
    const ct = Number(c['消費税中間回数(0/1/3/11)'] || 0);
    for (let y = ty - 1; y <= ty + 1; y++) {
      push(c, '法人税・地方税 中間', monthEndAfter(y, fm, 8));
      if (ct === 1) push(c, '消費税 中間(年1回)', monthEndAfter(y, fm, 8));
      if (ct === 3) [5, 8, 11].forEach((off, i) => push(c, '消費税 中間(年3回・第' + (i + 1) + '回)', monthEndAfter(y, fm, off)));
    }
    if (ct === 11) manual.push(c['会社名']);
  });

  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  SpreadsheetApp.getUi().alert(
    rows.length + ' 件の期限行を生成しました。\n\n' +
    '→「予定納税一覧」シートで金額を入力してください(前期申告書・税務署からの通知を参照)。\n' +
    '→ 減額申請や前期税額により中間が不要な行は、ステータスを「対象外」に変更してください。\n' +
    (manual.length ? '\n⚠️ 消費税中間が年11回の以下の顧問先は手動で登録してください:\n' + manual.join('、') : '')
  );
}

// ============================== ③ 期限プレビュー ==============================

function previewUpcoming() {
  const s = getSettings();
  const t0 = today0();
  const { events, warnings } = collectEvents(s);
  const rows = events
    .map(ev => ({ ev: ev, days: daysBetween(t0, ev.due) }))
    .filter(x => x.days >= 0 && x.days <= 60)
    .sort((a, b) => a.ev.due - b.ev.due)
    .map(x => [fmt(x.ev.due), x.days, x.ev.company, x.ev.type, x.ev.email || '⚠️メール未登録']);

  let sh = ss().getSheetByName(SHEET.preview);
  if (!sh) sh = ss().insertSheet(SHEET.preview);
  sh.clear();
  sh.getRange(1, 1, 1, 5).setValues([['期限日', '残日数', '会社名', '項目', '通知先']])
    .setFontWeight('bold').setBackground('#e8f5ee');
  sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows);
  sh.autoResizeColumns(1, 5);

  SpreadsheetApp.getUi().alert(
    '今後60日の期限 ' + rows.length + ' 件を「期限プレビュー」シートに出力しました。' +
    (warnings.length ? '\n\n⚠️ 警告:\n' + warnings.join('\n') : '')
  );
}

// ============================== ⑤ トリガー設定 ==============================

function createDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'dailyCheck')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(7).create();
  SpreadsheetApp.getUi().alert(
    '毎朝7時台に自動チェックを実行するよう設定しました。\n\n' +
    '現在の送信モード:' + (getSettings()['送信モード'] || '未設定') +
    '\n本番運用を開始するには「設定」シートの送信モードを「本番」に変更してください。'
  );
}
