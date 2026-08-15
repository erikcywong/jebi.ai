"""Pydantic 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    user_id: str = Field(..., description="脱敏后的用户 ID")
    store_id: str = Field(..., description="门店 ID")
    location: str | None = None
    weather: str | None = None
    time_of_day: str | None = None
    history: list[str] = Field(default_factory=list, description="最近消费的咖啡类型")
    dietary_prefs: list[str] = Field(default_factory=list)
    budget: float | None = None
    lang: str = Field(default="zh", description="响应语言: en | zh | ar")


class RecommendResponse(BaseModel):
    recommendation: str
    reason: str
    confidence: float
    charged_jbp: int
    inventory_status: str
    alternatives: list[str]


class QuoteResponse(BaseModel):
    role: str
    cost_cny: float
    charged_jbp: int
    charged_cny: float
    markup: float
    note: str


class BalanceResponse(BaseModel):
    user_id: str
    role: str
    jbp_balance: int
    subscription_active: bool


class TopupRequest(BaseModel):
    user_id: str
    amount_jbp: int = Field(..., gt=0)
    reason: str = "recharge"