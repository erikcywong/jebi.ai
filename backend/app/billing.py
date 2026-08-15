"""统一计量计价核心（修正点 A2 的核心实现）。

原则：
  1) 所有 AI 调用先按实际 usage（输入/输出 token，含缓存命中）核算 DeepSeek 成本（人民币）；
  2) 再按调用方角色应用定价策略，得到应收 JBP；
  3) 同一 usage 在不同角色下价格不同，但口径唯一、可审计、可对账。

消除初版「5 JBP vs 50 JBP」矛盾的方式：
  - C 端订阅内调用应收 0 JBP（成本计入订阅定价模型）；
  - C 端按量保底 10 JBP；B 端按量保底 50 JBP 且随用量线性增长。
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from config import Settings

# 角色常量
ROLE_CONSUMER_BUNDLE = "consumer_bundle"  # C 端订阅用户（AI 调用含在订阅内）
ROLE_CONSUMER_PAYG = "consumer_payg"      # C 端非订阅按量
ROLE_BUSINESS = "business"                # B 端：加盟商/供应商/开发者
VALID_ROLES = {ROLE_CONSUMER_BUNDLE, ROLE_CONSUMER_PAYG, ROLE_BUSINESS}


@dataclass(frozen=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0  # 命中缓存的输入 token 数（DeepSeek: prompt_cache_hit_tokens）


@dataclass(frozen=True)
class Quote:
    role: str
    cost_cny: float     # 本次调用的 DeepSeek 成本（人民币）
    charged_jbp: int    # 向调用方收取的 JBP（订阅内为 0）
    charged_cny: float  # 等值人民币（1 JBP = 0.1 元，仅记账展示）
    markup: float       # 实际加价倍率（成本 → 售价）
    note: str


def deepseek_cost_cny(usage: Usage, settings: Settings) -> float:
    """按 DeepSeek 官方计价口径核算成本（人民币）。

    缓存命中输入按 cache_hit_ratio 折算，输出全额计。
    """
    input_cost = (
        usage.input_tokens / 1_000_000 * settings.price_input_per_m_cny
        + usage.cached_input_tokens / 1_000_000 * settings.price_input_per_m_cny * settings.cache_hit_ratio
    )
    output_cost = usage.output_tokens / 1_000_000 * settings.price_output_per_m_cny
    return input_cost + output_cost


def jbp_from_cny(cny: float, settings: Settings) -> int:
    """人民币 → JBP（向上取整，保证平台不亏损）。"""
    if cny <= 0:
        return 0
    return math.ceil(cny / settings.jbp_anchor_cny)


def quote_call(usage: Usage, role: str, settings: Settings) -> Quote:
    """统一计价入口：同一 usage 在不同角色下得到唯一、可审计的报价。"""
    if role not in VALID_ROLES:
        raise ValueError(f"unknown role: {role}")

    cost_cny = deepseek_cost_cny(usage, settings)

    if role == ROLE_CONSUMER_BUNDLE:
        # 订阅内：成本 × c_bundle_markup 计入订阅定价模型，向用户收 0 JBP
        bundled_cost_cny = cost_cny * settings.c_bundle_markup
        return Quote(role, cost_cny, 0, 0.0, settings.c_bundle_markup,
                     f"订阅内调用，成本 {bundled_cost_cny:.4f} 元已计入订阅费，应收 0 JBP")

    if role == ROLE_CONSUMER_PAYG:
        price_cny = max(cost_cny * settings.c_payg_markup,
                        settings.c_payg_min_jbp * settings.jbp_anchor_cny)
        jbp = jbp_from_cny(price_cny, settings)
        markup = price_cny / cost_cny if cost_cny > 0 else float("inf")
        return Quote(role, cost_cny, jbp, jbp * settings.jbp_anchor_cny, markup,
                     "C 端按量：成本 × 3，保底 10 JBP")

    # business
    price_cny = max(cost_cny * settings.b_markup,
                    settings.b_call_base_jbp * settings.jbp_anchor_cny)
    jbp = jbp_from_cny(price_cny, settings)
    markup = price_cny / cost_cny if cost_cny > 0 else float("inf")
    return Quote(role, cost_cny, jbp, jbp * settings.jbp_anchor_cny, markup,
                 "B 端按量：成本 × 5，保底 50 JBP")
