"""Jebi Brain API 网关（参考实现）。

路由：
  POST /api/v1/recommend/personalized   消费者个性化推荐（统一计量计费，修正点 A2）
  POST /api/v1/billing/quote            预报价（不扣费）
  GET  /api/v1/users/{user_id}/balance  余额查询
  POST /api/v1/users/{user_id}/topup    充值（单笔/余额上限，修正点 B2）
  POST /api/v1/users/{user_id}/refund   7 天冷静期退款（修正点 B2）
  GET  /api/v1/admin/usage/summary      用量对账（与 DeepSeek 账单比对）
  GET  /healthz
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import Settings, load_settings
from billing import Usage, quote_call, ROLE_CONSUMER_BUNDLE, ROLE_CONSUMER_PAYG
from ledger import Ledger
from ai_service import JebiBrain
from models import RecommendRequest, RecommendResponse, QuoteResponse, BalanceResponse, TopupRequest

settings = load_settings()
ledger = Ledger(settings.db_path)
brain = JebiBrain(settings)

app = FastAPI(
    title="Jebi Brain API",
    description="Jebi Coffee AI 产业引擎：DeepSeek 能力封装 + JBP 统一计量计费",
    version="2.0.0",
)

# 开发期放开跨域（网站与 API 同源部署时无需；生产按域名白名单收紧）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _auth_user(x_jebi_user: str | None) -> dict:
    """演示用鉴权：生产环境替换为 JWT 校验。"""
    if not x_jebi_user:
        raise HTTPException(401, detail={"code": "UNAUTHORIZED", "message": "missing X-Jebi-User header"})
    return {"user_id": x_jebi_user}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "model": settings.deepseek_model}


@app.post("/api/v1/billing/quote", response_model=QuoteResponse)
def quote(req: RecommendRequest, x_jebi_role: str | None = Header(default=None)):
    """预报价：按角色与典型用量估算应收 JBP，不扣费；实际以调用后的 usage 为准。"""
    role = (x_jebi_role or ROLE_CONSUMER_BUNDLE).lower()
    if role not in (ROLE_CONSUMER_BUNDLE, ROLE_CONSUMER_PAYG, "business"):
        raise HTTPException(400, detail={"code": "INVALID_ROLE", "message": "role must be consumer_bundle | consumer_payg | business"})
    est = Usage(input_tokens=500, output_tokens=200, cached_input_tokens=100)  # 典型调用
    q = quote_call(est, role, settings)
    return QuoteResponse(role=q.role, cost_cny=round(q.cost_cny, 6), charged_jbp=q.charged_jbp,
                         charged_cny=round(q.charged_cny, 4), markup=q.markup, note=q.note)


@app.post("/api/v1/recommend/personalized", response_model=RecommendResponse)
async def recommend(req: RecommendRequest, x_jebi_user: str | None = Header(default=None),
                    x_jebi_role: str | None = Header(default=None)):
    user = _auth_user(x_jebi_user)
    user_id = user["user_id"]
    role = (x_jebi_role or ROLE_CONSUMER_BUNDLE).lower()
    if role not in (ROLE_CONSUMER_BUNDLE, ROLE_CONSUMER_PAYG, "business"):
        raise HTTPException(400, detail={"code": "INVALID_ROLE", "message": "role must be consumer_bundle | consumer_payg | business"})

    # 订阅用户自动归入 bundle；未订阅却以 bundle 身份调用 → 拒绝（须开通订阅或走按量）
    rec = ledger.ensure_user(user_id, role, subscription=(role == ROLE_CONSUMER_BUNDLE))
    if role == ROLE_CONSUMER_BUNDLE and not rec["subscription_active"]:
        raise HTTPException(402, detail={"code": "SUBSCRIPTION_REQUIRED",
                                         "message": "请先开通订阅，或使用按量计费（X-Jebi-Role: consumer_payg）"})

    # 调用 DeepSeek（真实计量）
    try:
        lang = (req.lang or "zh").lower()
        result = await brain.recommend(req.model_dump(), inventory="in_stock", lang=lang)
    except Exception as exc:
        raise HTTPException(500, detail={"code": "MODEL_ERROR", "message": f"DeepSeek 调用失败: {exc}"})

    # 按实际 usage 统一计价 → 扣费 → 写日志（对账闭环）
    usage = result["usage"]
    q = quote_call(usage, role, settings)
    if q.charged_jbp > 0:
        ok = ledger.charge(user_id, q.charged_jbp, f"ai:{q.role}:recommend")
        if not ok:
            raise HTTPException(402, detail={"code": "INSUFFICIENT_JBP",
                                             "message": f"JBP 余额不足，本次需 {q.charged_jbp} JBP（{q.charged_cny:.1f} 元）"})
    ledger.log_usage(user_id, "recommend", usage, q.cost_cny, q.charged_jbp,
                     q.charged_jbp, q.role, result["model"])

    data = result["data"]
    return RecommendResponse(
        recommendation=data.get("recommendation", ""),
        reason=data.get("reason", ""),
        confidence=float(data.get("confidence", 0.0)),
        charged_jbp=q.charged_jbp,
        inventory_status="in_stock",
        alternatives=data.get("alternatives", []),
    )


@app.get("/api/v1/users/{user_id}/balance", response_model=BalanceResponse)
def balance(user_id: str, x_jebi_user: str | None = Header(default=None)):
    _auth_user(x_jebi_user)
    rec = ledger.ensure_user(user_id, ROLE_CONSUMER_PAYG)
    return BalanceResponse(user_id=rec["id"], role=rec["role"],
                           jbp_balance=rec["jbp_balance"], subscription_active=rec["subscription_active"])


@app.post("/api/v1/users/{user_id}/topup")
def topup(user_id: str, body: TopupRequest, x_jebi_user: str | None = Header(default=None)):
    """充值 JBP。合规约束（修正点 B2）：单笔上限 + 余额上限，全部走流水。"""
    _auth_user(x_jebi_user)
    rec = ledger.ensure_user(user_id, ROLE_CONSUMER_PAYG)
    if body.amount_jbp > settings.topup_single_limit_jbp:
        raise HTTPException(400, detail={"code": "LIMIT_EXCEEDED",
                                         "message": f"单笔充值上限 {settings.topup_single_limit_jbp} JBP（{settings.topup_single_limit_jbp * settings.jbp_anchor_cny:.0f} 元）"})
    if rec["jbp_balance"] + body.amount_jbp > settings.topup_balance_cap_jbp:
        raise HTTPException(400, detail={"code": "BALANCE_CAP",
                                         "message": f"账户积分余额上限 {settings.topup_balance_cap_jbp} JBP（{settings.topup_balance_cap_jbp * settings.jbp_anchor_cny:.0f} 元）"})
    ledger.credit(user_id, body.amount_jbp, body.reason)
    return {"user_id": user_id, "jbp_balance": rec["jbp_balance"] + body.amount_jbp}


@app.post("/api/v1/users/{user_id}/subscribe")
def subscribe(user_id: str, body: SubscribeRequest, x_jebi_user: str | None = Header(default=None)):
    """开通/取消订阅（演示辅助：真实场景走支付流程）。订阅用户 AI 调用应收 0 JBP。"""
    _auth_user(x_jebi_user)
    rec = ledger.ensure_user(user_id, ROLE_CONSUMER_BUNDLE, subscription=body.active)
    rec = ledger.set_subscription(user_id, body.active)
    return {"user_id": user_id, "subscription_active": rec["subscription_active"]}


@app.post("/api/v1/users/{user_id}/refund")
def refund(user_id: str, x_jebi_user: str | None = Header(default=None)):
    """7 天冷静期退款（修正点 B2）：冲销最近一次充值；若积分已消耗则拒绝并提示。"""
    _auth_user(x_jebi_user)
    rec = ledger.get_user(user_id)
    if rec is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "user not found"})
    recharge = ledger.latest_recharge(user_id, settings.refund_cooling_days)
    if recharge is None:
        raise HTTPException(400, detail={"code": "NO_REFUNDABLE_RECHARGE",
                                         "message": f"最近 {settings.refund_cooling_days} 天内没有可退款的充值"})
    ok = ledger.charge(user_id, recharge["amount"], "refund:cooling", ref_id=recharge["id"])
    if not ok:
        raise HTTPException(400, detail={"code": "BALANCE_SPENT",
                                         "message": "积分已消耗，无法执行冷静期退款（余额不足）"})
    return {"user_id": user_id, "refunded_jbp": recharge["amount"],
            "jbp_balance": ledger.get_user(user_id)["jbp_balance"]}


@app.get("/api/v1/admin/usage/summary")
def usage_summary():
    """对账：累计成本 vs 累计应收，与 DeepSeek 官方账单比对。"""
    return ledger.usage_summary()


# ---- 网站静态资源（jebi-coffee/web）----
# API 路由已在上方注册，此处挂载 "/" 兜底其余路径；同源部署时一个进程同时提供 API 与网站。
WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "web"))
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
else:
    print(f"[warn] web static dir not found: {WEB_DIR}")