"""全局配置。所有价格/合规参数均通过环境变量可覆盖（见 .env.example）。

修正点 A1：DeepSeek 成本不再硬编码 2024 年老价格，全部参数化，
随官方调价（https://api-docs.deepseek.com/quick_start/pricing）更新环境变量即可。
"""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # ---- DeepSeek 接入 ----
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    # ---- DeepSeek 成本（人民币 / 百万 token）----
    # 参考价（deepseek-chat，2025- 官方价格页）：输入(未命中缓存) ~$0.27/M ≈ 1.95 元/M；
    # 输入(命中缓存) ~$0.07/M（约 0.26 折）；输出 ~$1.10/M ≈ 7.95 元/M。
    # 新模型/调价后请更新以下三个值。
    price_input_per_m_cny: float = 1.95
    price_output_per_m_cny: float = 7.95
    cache_hit_ratio: float = 0.26  # 命中缓存价格 / 未命中价格

    # ---- JBP 锚定 ----
    jbp_anchor_cny: float = 0.1  # 1 JBP = 0.1 元（仅内部记账，不构成双向兑换）

    # ---- 定价策略（修正点 A2：统一计量，先算成本、再按角色定价）----
    c_bundle_markup: float = 3.0    # C 端订阅内调用：成本 × 3 计入订阅价，应收 0 JBP
    c_payg_markup: float = 3.0      # C 端按量：成本 × 3
    c_payg_min_jbp: int = 10        # C 端按量保底 10 JBP（1 元）
    b_markup: float = 5.0           # B 端按量：成本 × 5 毛利
    b_call_base_jbp: int = 50       # B 端单次调用保底 50 JBP（5 元）

    # ---- 运营与合规（修正点 B2：预付卡约束）----
    ai_timeout_s: float = 20.0
    db_path: str = "jebi.db"
    topup_single_limit_jbp: int = 10_000   # 单笔充值上限（=1000 元）
    topup_balance_cap_jbp: int = 50_000    # 单账户积分余额上限（=5000 元）
    refund_cooling_days: int = 7           # 充值冷静期（天），期间可无理由退款


def load_settings() -> Settings:
    env = os.getenv

    def f(name: str, default: str) -> str:
        return env(name, default)

    return Settings(
        deepseek_api_key=f("DEEPSEEK_API_KEY", ""),
        deepseek_base_url=f("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
        deepseek_model=f("DEEPSEEK_MODEL", "deepseek-chat"),
        price_input_per_m_cny=float(f("PRICE_INPUT_PER_M_CNY", "1.95")),
        price_output_per_m_cny=float(f("PRICE_OUTPUT_PER_M_CNY", "7.95")),
        cache_hit_ratio=float(f("PRICE_CACHE_HIT_RATIO", "0.26")),
        jbp_anchor_cny=float(f("JBP_ANCHOR_CNY", "0.1")),
        c_bundle_markup=float(f("C_BUNDLE_MARKUP", "3.0")),
        c_payg_markup=float(f("C_PAYG_MARKUP", "3.0")),
        c_payg_min_jbp=int(f("C_PAYG_MIN_JBP", "10")),
        b_markup=float(f("B_MARKUP", "5.0")),
        b_call_base_jbp=int(f("B_CALL_BASE_JBP", "50")),
        ai_timeout_s=float(f("AI_TIMEOUT_S", "20.0")),
        db_path=f("JBP_DB_PATH", "jebi.db"),
        topup_single_limit_jbp=int(f("TOPUP_SINGLE_LIMIT_JBP", "10000")),
        topup_balance_cap_jbp=int(f("TOPUP_BALANCE_CAP_JBP", "50000")),
        refund_cooling_days=int(f("REFUND_COOLING_DAYS", "7")),
    )
