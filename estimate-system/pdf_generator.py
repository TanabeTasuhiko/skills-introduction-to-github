"""
PDF見積書ジェネレーター
Japanese-compatible PDF generation using fpdf2
"""

import os
from datetime import datetime

from fpdf import FPDF
from fpdf.enums import XPos, YPos


def _setup_font(pdf: FPDF):
    """日本語フォントの設定。システムフォントまたはフォールバック利用。"""
    font_paths = [
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJKjp-Regular.otf",
        "/usr/share/fonts/truetype/takao-gothic/TakaoGothic.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    ]

    for path in font_paths:
        if os.path.exists(path):
            try:
                pdf.add_font("jp", style="", fname=path)
                pdf.add_font("jp", style="B", fname=path)
                return "jp"
            except Exception:
                continue

    return "Helvetica"


def _cell_ln(pdf, w, h, text="", fill=False, align="", **kwargs):
    """cell with new_x/new_y instead of deprecated ln=True."""
    pdf.cell(w, h, text=text, fill=fill, align=align,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT, **kwargs)


def _cell(pdf, w, h, text="", fill=False, align="", **kwargs):
    """cell without line break."""
    pdf.cell(w, h, text=text, fill=fill, align=align, **kwargs)


def generate_estimate_pdf(data: dict, output_dir: str) -> str:
    """
    見積データからPDFを生成し、ファイルパスを返す。

    Args:
        data: フロントから受け取る見積データ
        output_dir: PDF出力先ディレクトリ
    Returns:
        生成されたPDFファイルのパス
    """
    os.makedirs(output_dir, exist_ok=True)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    font_name = _setup_font(pdf)

    client_name = data.get("client_name", "")
    lines = data.get("lines", [])
    total = data.get("total", 0)
    risk_score = data.get("risk_score", 0)
    risk_flags = data.get("risk_flags", [])
    today = datetime.now().strftime("%Y年%m月%d日")

    # --- Header ---
    pdf.set_font(font_name, "B", 20)
    pdf.set_text_color(26, 77, 110)
    _cell_ln(pdf, 0, 15, text="見積書", align="C")
    pdf.set_font(font_name, "", 9)
    pdf.set_text_color(120, 120, 120)
    _cell_ln(pdf, 0, 6, text=f"作成日: {today}", align="R")
    pdf.ln(5)

    # --- Client info ---
    pdf.set_draw_color(26, 77, 110)
    pdf.set_font(font_name, "B", 12)
    pdf.set_text_color(44, 62, 80)
    _cell_ln(pdf, 0, 10, text=f"{client_name} 様")
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    # --- Risk badge (internal) ---
    if risk_score > 10:
        pdf.set_fill_color(253, 232, 232)
        pdf.set_text_color(192, 57, 43)
        pdf.set_font(font_name, "B", 9)
        label = f"[内部情報] リスクスコア: {risk_score}/20 - 受注見送り推奨"
        _cell_ln(pdf, 0, 8, text=label, fill=True)
        pdf.ln(2)
    elif risk_score > 5:
        pdf.set_fill_color(254, 245, 231)
        pdf.set_text_color(214, 137, 16)
        pdf.set_font(font_name, "B", 9)
        label = f"[内部情報] リスクスコア: {risk_score}/20 - 要注意"
        _cell_ln(pdf, 0, 8, text=label, fill=True)
        pdf.ln(2)

    if risk_flags:
        pdf.set_font(font_name, "", 8)
        pdf.set_text_color(150, 150, 150)
        _cell_ln(pdf, 0, 5, text=f"  リスク要因: {', '.join(risk_flags)}")
        pdf.ln(3)

    # --- Estimate table ---
    pdf.set_font(font_name, "B", 11)
    pdf.set_text_color(26, 77, 110)
    _cell_ln(pdf, 0, 10, text="報酬明細")

    # Table header
    pdf.set_fill_color(26, 77, 110)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_name, "B", 10)
    _cell(pdf, 130, 9, text="  項目", fill=True)
    _cell(pdf, 50, 9, text="金額（税別）", fill=True, align="R")
    pdf.ln()

    # Table rows
    pdf.set_text_color(44, 62, 80)
    pdf.set_font(font_name, "", 10)
    for i, line in enumerate(lines):
        label = line.get("label", "")
        amount = line.get("amount", 0)

        if i % 2 == 0:
            pdf.set_fill_color(245, 247, 250)
        else:
            pdf.set_fill_color(255, 255, 255)

        _cell(pdf, 130, 8, text=f"  {label}", fill=True)
        _cell(pdf, 50, 8, text=f"¥{amount:,.0f}", fill=True, align="R")
        pdf.ln()

    # Total
    pdf.ln(2)
    pdf.set_line_width(0.8)
    pdf.set_draw_color(26, 77, 110)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)
    pdf.set_font(font_name, "B", 13)
    pdf.set_text_color(26, 77, 110)
    _cell(pdf, 130, 10, text="  合計（税込）")
    _cell(pdf, 50, 10, text=f"¥{total:,.0f}", align="R")
    pdf.ln(15)

    # --- Contract clauses ---
    pdf.set_font(font_name, "B", 10)
    pdf.set_text_color(44, 62, 80)
    _cell_ln(pdf, 0, 8, text="契約条項")
    pdf.set_line_width(0.3)
    pdf.set_draw_color(220, 225, 232)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    clauses = [
        "1. 本見積書に記載されたサービスのみを対象とします。記載外の業務は別途見積もりとなります。",
        "2. 追加作業はタイムチャージ（1時間あたり15,000円）にて別途請求します。",
        "3. 必要資料の提供が1ヶ月以上遅延した場合、追加料金が発生する場合があります。",
        "4. 損害賠償の範囲は年間報酬額を上限とします。",
        "5. 解約は1ヶ月前までに書面にて通知するものとします。",
        "6. すべてのやり取りは記録・保存されます。",
    ]

    pdf.set_font(font_name, "", 8)
    pdf.set_text_color(100, 100, 100)
    for clause in clauses:
        pdf.multi_cell(0, 5, text=clause)
        pdf.ln(1)

    # --- Footer ---
    pdf.ln(10)
    pdf.set_font(font_name, "", 8)
    pdf.set_text_color(150, 150, 150)
    _cell_ln(pdf, 0, 5, text="本見積書の有効期限は発行日より30日間です。", align="C")

    # Save
    filename = f"estimate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(output_dir, filename)
    pdf.output(filepath)

    return filepath
