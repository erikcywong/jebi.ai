"""API 冒烟测试：验证网关、统一计量计费、台账全链路（无需真实 DeepSeek Key）。

运行：.venv/Scripts/python scripts/smoke_api.py
"""
from __future__ import annotations

import os
import sys
import tempfile

# 用临时数据库，避免污染项目目录
tmpdir = tempfile.mkdtemp(prefix="jebi_smoke_")
os.environ["JBP_DB_PATH"] = os.path.join(tmpdir, "smoke.db")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from fastapi.testclient import TestClient
import main as main_mod
from billing import Usage

app = main_mod.app
client = TestClient(app)


async def fake_recommend(payload, inventory=None, lang="zh"):
    """模拟 DeepSeek 返回（真实调用需 DEEPSEEK_API_KEY）。"""
    return {
        "data": {"recommendation": "燕麦奶拿铁（少糖）", "reason": "结合历史偏好与天气",
                 "confidence": 0.87, "alternatives": ["燕麦奶卡布奇诺", "冰燕麦拿铁"]},
        "usage": Usage(input_tokens=510, output_tokens=190, cached_input_tokens=100),
        "model": "deepseek-chat",
    }


def check(name, cond, extra=""):
    print(f"{'PASS' if cond else 'FAIL'}  {name}  {extra}")
    return cond


def main():
    ok = True

    r = client.get("/healthz")
    ok &= check("healthz", r.status_code == 200, str(r.json()))

    r = client.post("/api/v1/users/u_001/topup",
                    json={"user_id": "u_001", "amount_jbp": 1000},
                    headers={"X-Jebi-User": "u_001"})
    ok &= check("topup 1000", r.status_code == 200 and r.json()["jbp_balance"] == 1000, str(r.json()))

    r = client.post("/api/v1/billing/quote",
                    json={"user_id": "u_001", "store_id": "s_001", "history": ["Latte"]},
                    headers={"X-Jebi-Role": "business"})
    ok &= check("quote business floor 50 JBP", r.status_code == 200 and r.json()["charged_jbp"] == 50,
                str(r.json()))

    r = client.post("/api/v1/billing/quote",
                    json={"user_id": "u_001", "store_id": "s_001", "history": ["Latte"]},
                    headers={"X-Jebi-Role": "consumer_bundle"})
    ok &= check("quote bundle 0 JBP", r.status_code == 200 and r.json()["charged_jbp"] == 0, str(r.json()))

    # 未开通订阅却以 bundle 身份调用 → 402 SUBSCRIPTION_REQUIRED
    r = client.post("/api/v1/recommend/personalized",
                    json={"user_id": "u_001", "store_id": "s_001", "history": ["Latte"]},
                    headers={"X-Jebi-User": "u_001"})
    ok &= check("bundle without subscription rejected", r.status_code == 402, str(r.json()))

    # 未配置 API Key：内置演示数据（计量与计费逻辑不变）→ B 端保底 50 JBP
    r = client.post("/api/v1/recommend/personalized",
                    json={"user_id": "u_001", "store_id": "s_001", "history": ["Latte"]},
                    headers={"X-Jebi-User": "u_001", "X-Jebi-Role": "business"})
    ok &= check("recommend without key -> demo mock charged 50", r.status_code == 200 and r.json()["charged_jbp"] == 50,
                str(r.json()))

    # 模拟 DeepSeek 成功：B 端按量扣 50 JBP 并记账
    main_mod.brain.recommend = fake_recommend
    r = client.post("/api/v1/recommend/personalized",
                    json={"user_id": "u_001", "store_id": "s_001", "location": "深圳南山",
                          "weather": "阴天 28°C", "time_of_day": "afternoon",
                          "history": ["Latte", "Cold Brew"], "dietary_prefs": ["plant-milk"],
                          "budget": 30},
                    headers={"X-Jebi-User": "u_001", "X-Jebi-Role": "business"})
    body = r.json()
    ok &= check("recommend (mocked) business charged 50", r.status_code == 200 and body["charged_jbp"] == 50,
                str(body))
    ok &= check("recommend content", body["recommendation"] == "燕麦奶拿铁（少糖）", str(body))

    r = client.get("/api/v1/users/u_001/balance", headers={"X-Jebi-User": "u_001"})
    ok &= check("balance after two charges = 900", r.status_code == 200 and r.json()["jbp_balance"] == 900,
                str(r.json()))

    r = client.get("/api/v1/admin/usage/summary")
    ok &= check("usage summary calls=2 charged=100", r.status_code == 200 and r.json()["calls"] == 2 and r.json()["total_charged_jbp"] == 100,
                str(r.json()))

    # 7 天冷静期退款：最近充值 1000 JBP，但余额 950 不足 → 400 BALANCE_SPENT
    r = client.post("/api/v1/users/u_001/refund", headers={"X-Jebi-User": "u_001"})
    ok &= check("cooling refund rejected when spent", r.status_code == 400, str(r.json()))

    # 订阅用户：bundle 调用应收 0
    main_mod.ledger.ensure_user("u_002", "consumer_bundle", subscription=True)
    r = client.post("/api/v1/recommend/personalized",
                    json={"user_id": "u_002", "store_id": "s_001", "history": ["Cold Brew"]},
                    headers={"X-Jebi-User": "u_002", "X-Jebi-Role": "consumer_bundle"})
    ok &= check("bundle subscriber charged 0", r.status_code == 200 and r.json()["charged_jbp"] == 0,
                str(r.json()))

    print("\n" + ("ALL PASS" if ok else "SOME FAILED"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()