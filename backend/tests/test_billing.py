"""统一计价回归测试（修正点 A2）。

可直接运行：python tests/test_billing.py
或 pytest：pytest tests/ -q
"""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from config import Settings
from billing import (Usage, deepseek_cost_cny, quote_call, jbp_from_cny,
                     ROLE_CONSUMER_BUNDLE, ROLE_CONSUMER_PAYG, ROLE_BUSINESS)


def test_deepseek_cost_matches_official_estimate():
    """成本口径与 DeepSeek 官方计价一致（缓存命中按 0.26 折算）。"""
    s = Settings()
    u = Usage(input_tokens=500, output_tokens=200, cached_input_tokens=100)
    cost = deepseek_cost_cny(u, s)
    expected = (500 / 1e6 * s.price_input_per_m_cny
                + 100 / 1e6 * s.price_input_per_m_cny * s.cache_hit_ratio
                + 200 / 1e6 * s.price_output_per_m_cny)
    assert abs(cost - expected) < 1e-12


def test_bundle_charges_zero_but_books_cost():
    """C 端订阅内调用：应收 0 JBP，但成本照记（计入订阅定价模型）。"""
    s = Settings()
    u = Usage(input_tokens=500, output_tokens=200, cached_input_tokens=100)
    q = quote_call(u, ROLE_CONSUMER_BUNDLE, s)
    assert q.charged_jbp == 0
    assert q.cost_cny > 0


def test_business_charge_has_floor_50_jbp():
    """B 端按量：保底 50 JBP（消除初版 5/50 JBP 矛盾中的下限）。"""
    s = Settings()
    tiny = Usage(input_tokens=50, output_tokens=20, cached_input_tokens=0)
    q = quote_call(tiny, ROLE_BUSINESS, s)
    assert q.charged_jbp >= s.b_call_base_jbp


def test_business_charge_scales_with_usage():
    """B 端大批量调用：超出保底价，按用量线性增长。"""
    s = Settings()
    big = Usage(input_tokens=500_000, output_tokens=200_000, cached_input_tokens=0)
    q = quote_call(big, ROLE_BUSINESS, s)
    assert q.charged_jbp > s.b_call_base_jbp


def test_payg_has_min_10_jbp():
    """C 端按量：保底 10 JBP。"""
    s = Settings()
    tiny = Usage(input_tokens=50, output_tokens=20, cached_input_tokens=0)
    q = quote_call(tiny, ROLE_CONSUMER_PAYG, s)
    assert q.charged_jbp >= s.c_payg_min_jbp


def test_rounding_is_ceil_not_floor():
    """人民币 → JBP 向上取整，平台不亏损。"""
    s = Settings()
    assert jbp_from_cny(0.01, s) == 1
    assert jbp_from_cny(0.1, s) == 1
    assert jbp_from_cny(0.0, s) == 0


def test_ledger_charge_and_usage_log():
    """台账：充值/扣费/余额不足拒绝/用量日志/对账汇总。"""
    from ledger import Ledger
    with tempfile.TemporaryDirectory() as d:
        lg = Ledger(os.path.join(d, "t.db"))
        lg.ensure_user("u1", ROLE_BUSINESS)
        lg.credit("u1", 100, "seed")
        assert lg.get_user("u1")["jbp_balance"] == 100

        ok = lg.charge("u1", 60, "ai:business:recommend")
        assert ok
        assert lg.get_user("u1")["jbp_balance"] == 40

        ok2 = lg.charge("u1", 9999, "too-much")
        assert not ok2
        assert lg.get_user("u1")["jbp_balance"] == 40  # 余额不足不产生流水

        u = Usage(input_tokens=100, output_tokens=50, cached_input_tokens=0)
        log_id = lg.log_usage("u1", "recommend", u, 0.0008, 0, 50, ROLE_BUSINESS, "deepseek-chat")
        assert log_id
        s = lg.usage_summary()
        assert s["calls"] == 1
        assert s["total_charged_jbp"] == 50
        lg.close()  # 释放文件句柄，便于 Windows 临时目录清理


def test_topup_and_cooling_refund():
    """B2 合规：充值上限校验 + 7 天冷静期退款。"""
    from ledger import Ledger
    with tempfile.TemporaryDirectory() as d:
        lg = Ledger(os.path.join(d, "t.db"))
        lg.ensure_user("u2", ROLE_CONSUMER_PAYG)
        s = Settings()
        # 模拟「单笔充值上限」逻辑（API 层校验，此处只验证台账退款路径）
        lg.credit("u2", 1000, "recharge")
        recharge = lg.latest_recharge("u2", s.refund_cooling_days)
        assert recharge is not None and recharge["amount"] == 1000
        ok = lg.charge("u2", recharge["amount"], "refund:cooling", ref_id=recharge["id"])
        assert ok
        assert lg.get_user("u2")["jbp_balance"] == 0
        lg.close()  # 释放文件句柄，便于 Windows 临时目录清理


def main():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()