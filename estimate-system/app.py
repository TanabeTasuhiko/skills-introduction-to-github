"""
報酬見積システム - Flask Backend
Tax Advisory Fee Estimator
"""

import json
import os
import uuid
from datetime import datetime

from flask import Flask, jsonify, request, send_file, send_from_directory

from pdf_generator import generate_estimate_pdf

app = Flask(__name__, static_folder="static")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
ESTIMATES_FILE = os.path.join(DATA_DIR, "estimates.json")


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(ESTIMATES_FILE):
        with open(ESTIMATES_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_estimates():
    _ensure_data_dir()
    with open(ESTIMATES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_estimates(data):
    _ensure_data_dir()
    with open(ESTIMATES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# --- Routes ---


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/estimate/pdf", methods=["POST"])
def create_pdf():
    """見積書のPDF生成"""
    payload = request.get_json()
    if not payload or not payload.get("client_name"):
        return jsonify({"error": "顧客名は必須です"}), 400

    pdf_path = generate_estimate_pdf(payload, DATA_DIR)
    return send_file(pdf_path, mimetype="application/pdf", as_attachment=True,
                     download_name=f"見積書_{payload['client_name']}.pdf")


@app.route("/api/estimate/save", methods=["POST"])
def save_estimate():
    """見積の保存"""
    payload = request.get_json()
    if not payload or not payload.get("client_name"):
        return jsonify({"error": "顧客名は必須です"}), 400

    estimates = _load_estimates()
    record = {
        "id": str(uuid.uuid4())[:8],
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "client_name": payload.get("client_name", ""),
        "client_contact": payload.get("client_contact", ""),
        "biz_type": payload.get("biz_type", ""),
        "services": payload.get("services", []),
        "lines": payload.get("lines", []),
        "total": payload.get("total", 0),
        "risk_score": payload.get("risk_score", 0),
        "risk_flags": payload.get("risk_flags", []),
        "memo": payload.get("memo", ""),
    }
    estimates.insert(0, record)
    _save_estimates(estimates)

    return jsonify({"status": "ok", "id": record["id"]})


@app.route("/api/estimates", methods=["GET"])
def list_estimates():
    """見積履歴一覧"""
    estimates = _load_estimates()
    return jsonify(estimates)


@app.route("/api/estimates/<estimate_id>", methods=["DELETE"])
def delete_estimate(estimate_id):
    """見積削除"""
    estimates = _load_estimates()
    estimates = [e for e in estimates if e.get("id") != estimate_id]
    _save_estimates(estimates)
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    _ensure_data_dir()
    app.run(debug=True, port=5000)
