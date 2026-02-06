"""
報酬見積システム テスト
"""

import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app
from pdf_generator import generate_estimate_pdf


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def sample_estimate():
    return {
        "client_name": "テスト太郎",
        "client_contact": "090-1234-5678",
        "biz_type": "corp_small",
        "services": ["tax_return", "bookkeeping"],
        "lines": [
            {"label": "確定申告", "amount": 200000},
            {"label": "記帳代行", "amount": 120000},
            {"label": "消費税（10%）", "amount": 32000},
        ],
        "total": 352000,
        "risk_score": 3,
        "risk_flags": [],
        "memo": "テスト用メモ",
    }


class TestIndexPage:
    def test_index_returns_html(self, client):
        res = client.get("/")
        assert res.status_code == 200
        assert b"<!DOCTYPE html>" in res.data


class TestEstimateSave:
    def test_save_and_list(self, client, sample_estimate):
        # 保存
        res = client.post("/api/estimate/save",
                          data=json.dumps(sample_estimate),
                          content_type="application/json")
        assert res.status_code == 200
        body = res.get_json()
        assert body["status"] == "ok"
        assert "id" in body

        # 一覧取得
        res = client.get("/api/estimates")
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) >= 1
        assert data[0]["client_name"] == "テスト太郎"
        assert data[0]["total"] == 352000

    def test_save_requires_client_name(self, client):
        res = client.post("/api/estimate/save",
                          data=json.dumps({"total": 100000}),
                          content_type="application/json")
        assert res.status_code == 400

    def test_delete_estimate(self, client, sample_estimate):
        # 保存
        res = client.post("/api/estimate/save",
                          data=json.dumps(sample_estimate),
                          content_type="application/json")
        eid = res.get_json()["id"]

        # 削除
        res = client.delete(f"/api/estimates/{eid}")
        assert res.status_code == 200

        # 確認
        res = client.get("/api/estimates")
        ids = [e["id"] for e in res.get_json()]
        assert eid not in ids


class TestPDFGeneration:
    def test_generate_pdf_creates_file(self, sample_estimate):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = generate_estimate_pdf(sample_estimate, tmpdir)
            assert os.path.exists(path)
            assert path.endswith(".pdf")
            assert os.path.getsize(path) > 0

    def test_pdf_endpoint(self, client, sample_estimate):
        res = client.post("/api/estimate/pdf",
                          data=json.dumps(sample_estimate),
                          content_type="application/json")
        assert res.status_code == 200
        assert res.content_type == "application/pdf"
        assert len(res.data) > 100

    def test_pdf_requires_client_name(self, client):
        res = client.post("/api/estimate/pdf",
                          data=json.dumps({"total": 100000}),
                          content_type="application/json")
        assert res.status_code == 400

    def test_pdf_with_high_risk(self, sample_estimate):
        sample_estimate["risk_score"] = 15
        sample_estimate["risk_flags"] = ["税理士変更3回以上", "未払い履歴"]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = generate_estimate_pdf(sample_estimate, tmpdir)
            assert os.path.exists(path)
            assert os.path.getsize(path) > 0


class TestRiskScenarios:
    """リスクスコアに応じた見積シナリオテスト"""

    def test_low_risk_estimate(self, client):
        data = {
            "client_name": "低リスク顧客",
            "biz_type": "corp_mid",
            "lines": [{"label": "税務顧問", "amount": 600000}],
            "total": 660000,
            "risk_score": 2,
            "risk_flags": [],
        }
        res = client.post("/api/estimate/save",
                          data=json.dumps(data),
                          content_type="application/json")
        assert res.status_code == 200

    def test_high_risk_estimate(self, client):
        data = {
            "client_name": "高リスク顧客",
            "biz_type": "individual",
            "lines": [
                {"label": "確定申告", "amount": 100000},
                {"label": "リスク加算（20%）", "amount": 20000},
            ],
            "total": 132000,
            "risk_score": 15,
            "risk_flags": ["税理士変更3回以上", "グレーゾーン", "未払い履歴"],
        }
        res = client.post("/api/estimate/save",
                          data=json.dumps(data),
                          content_type="application/json")
        assert res.status_code == 200
