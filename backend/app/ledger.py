"""JBP 积分台账与 AI 用量日志（SQLite，单机可运行；生产可换 PostgreSQL + 定时上链存证）。

表结构与文档「模块四」对齐：users / ai_usage_logs / jbp_ledger / warehouse_receipts / roast_packages。
所有积分变动（充值/扣费/奖励）都写 jbp_ledger 流水，保证可审计。
"""
from __future__ import annotations

import sqlite3
import threading
import uuid
from datetime import datetime, timezone

from billing import Usage

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  jbp_balance INTEGER NOT NULL DEFAULT 0,
  subscription_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cny REAL NOT NULL DEFAULT 0,
  cost_jbp INTEGER NOT NULL DEFAULT 0,
  charged_jbp INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jbp_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS warehouse_receipts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  quality_score REAL,
  registration_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roast_packages (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  bean_type TEXT NOT NULL,
  weight_g INTEGER NOT NULL,
  roast_curve TEXT NOT NULL,
  price_jbp INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Created',
  created_at TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Ledger:
    def __init__(self, db_path: str = "jebi.db"):
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    # ---------- 用户 ----------
    def ensure_user(self, user_id: str, role: str, subscription: bool = False) -> dict:
        with self._lock:
            row = self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if row is None:
                self._conn.execute(
                    "INSERT INTO users (id, role, jbp_balance, subscription_active, created_at) VALUES (?,?,?,?,?)",
                    (user_id, role, 0, 1 if subscription else 0, now_iso()))
                self._conn.commit()
                row = self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return self._row_to_user(row)

    def get_user(self, user_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return self._row_to_user(row) if row else None

    @staticmethod
    def _row_to_user(row) -> dict:
        return {
            "id": row[0], "role": row[1], "jbp_balance": row[2],
            "subscription_active": bool(row[3]), "created_at": row[4],
        }

    # ---------- 积分流水（全部走 ledger，保证可审计） ----------
    def credit(self, user_id: str, amount: int, reason: str, ref_id: str | None = None) -> None:
        with self._lock:
            self._conn.execute("UPDATE users SET jbp_balance = jbp_balance + ? WHERE id = ?", (amount, user_id))
            self._conn.execute(
                "INSERT INTO jbp_ledger (id, user_id, delta, reason, ref_id, created_at) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), user_id, amount, reason, ref_id, now_iso()))
            self._conn.commit()

    def charge(self, user_id: str, amount: int, reason: str, ref_id: str | None = None) -> bool:
        """扣费：余额不足返回 False，不产生任何流水。"""
        with self._lock:
            bal = self._conn.execute("SELECT jbp_balance FROM users WHERE id = ?", (user_id,)).fetchone()
            if bal is None or bal[0] < amount:
                return False
            self._conn.execute("UPDATE users SET jbp_balance = jbp_balance - ? WHERE id = ?", (amount, user_id))
            self._conn.execute(
                "INSERT INTO jbp_ledger (id, user_id, delta, reason, ref_id, created_at) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), user_id, -amount, reason, ref_id, now_iso()))
            self._conn.commit()
            return True

    def set_subscription(self, user_id: str, active: bool) -> dict:
        with self._lock:
            self._conn.execute("UPDATE users SET subscription_active = ? WHERE id = ?", (1 if active else 0, user_id))
            self._conn.commit()
            row = self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return self._row_to_user(row)

    def latest_recharge(self, user_id: str, within_days: int) -> dict | None:
        """最近一次充值（用于 7 天冷静期退款，修正点 B2）。"""
        with self._lock:
            row = self._conn.execute(
                """SELECT id, delta, reason, created_at FROM jbp_ledger
                   WHERE user_id = ? AND reason = 'recharge' AND delta > 0
                   ORDER BY created_at DESC LIMIT 1""", (user_id,)).fetchone()
        if row is None:
            return None
        created = datetime.fromisoformat(row[3])
        if (datetime.now(timezone.utc) - created).days >= within_days:
            return None
        return {"id": row[0], "amount": row[1], "created_at": row[3]}

    # ---------- AI 用量日志（对账用，修正点 A2） ----------
    def log_usage(self, user_id: str, service: str, usage: Usage, cost_cny: float,
                  cost_jbp: int, charged_jbp: int, role: str, model: str) -> str:
        log_id = str(uuid.uuid4())
        with self._lock:
            self._conn.execute(
                """INSERT INTO ai_usage_logs
                   (id, user_id, service_name, input_tokens, output_tokens, cached_input_tokens,
                    cost_cny, cost_jbp, charged_jbp, role, model, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (log_id, user_id, service, usage.input_tokens, usage.output_tokens,
                 usage.cached_input_tokens, round(cost_cny, 6), cost_jbp, charged_jbp,
                 role, model, now_iso()))
            self._conn.commit()
        return log_id

    def usage_summary(self) -> dict:
        """对账汇总：累计成本 vs 累计应收，与 DeepSeek 官方账单比对。"""
        with self._lock:
            row = self._conn.execute(
                """SELECT COUNT(*), COALESCE(SUM(cost_cny),0), COALESCE(SUM(charged_jbp),0)
                   FROM ai_usage_logs""").fetchone()
        return {
            "calls": row[0],
            "total_cost_cny": round(row[1], 4),
            "total_charged_jbp": row[2],
            "total_charged_cny": round(row[2] * 0.1, 4),
        }

    # ---------- 仓单 / 烘焙包台账（修正点 B3：登记号） ----------
    def add_receipt(self, batch_id: str, owner_id: str, weight_kg: float,
                    registration_id: str, quality_score: float | None = None) -> str:
        rid = str(uuid.uuid4())
        with self._lock:
            self._conn.execute(
                """INSERT INTO warehouse_receipts
                   (id, batch_id, owner_id, weight_kg, quality_score, registration_id, status, created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (rid, batch_id, owner_id, weight_kg, quality_score, registration_id, "active", now_iso()))
            self._conn.commit()
        return rid

    def list_receipts(self, owner_id: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM warehouse_receipts WHERE owner_id = ? ORDER BY created_at DESC", (owner_id,)).fetchall()
        cols = ["id", "batch_id", "owner_id", "weight_kg", "quality_score", "registration_id", "status", "created_at"]
        return [dict(zip(cols, r)) for r in rows]

    def close(self) -> None:
        """关闭连接（Windows 下释放文件句柄，便于测试临时目录清理）。"""
        with self._lock:
            self._conn.close()