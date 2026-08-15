"""Jebi Brain：DeepSeek 接入层。

- 使用官方 OpenAI 兼容端点（base_url 可配置，默认国内端点）
- 所有调用记录实际 usage（含缓存命中 token），交由 billing 统一计价（修正点 A2）
- 只传「当次」业务上下文，不批量回传训练数据（修正点 A4）
"""
from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI

from config import Settings
from billing import Usage
import prompts

logger = logging.getLogger("jebi.brain")

# 演示模式：未配置 DEEPSEEK_API_KEY 时返回的确定性响应。
# 用途：网站/演示环境无需真实 Key 即可体验完整流程；计量与计费逻辑与真实调用完全一致。
# 生产环境必须配置 Key，本分支不会被触发。
DEMO_RESPONSES = {
    "zh": {
        "recommend": {
            "data": {
                "recommendation": "燕麦奶拿铁（少糖）",
                "reason": "结合您常点的拿铁偏好与当前时段，推荐温暖少糖的植物奶拿铁。",
                "confidence": 0.87,
                "alternatives": ["燕麦奶卡布奇诺", "冰燕麦拿铁"],
            },
            "usage": Usage(input_tokens=520, output_tokens=210, cached_input_tokens=100),
            "model": "deepseek-chat (demo)",
        },
    },
    "en": {
        "recommend": {
            "data": {
                "recommendation": "Oat Milk Latte (Low Sugar)",
                "reason": "Based on your latte preference and the current time of day, a warm low-sugar oat milk latte suits you best.",
                "confidence": 0.87,
                "alternatives": ["Oat Milk Cappuccino", "Iced Oat Latte"],
            },
            "usage": Usage(input_tokens=520, output_tokens=210, cached_input_tokens=100),
            "model": "deepseek-chat (demo)",
        },
    },
    "ar": {
        "recommend": {
            "data": {
                "recommendation": "لاتيه بحليب الشوفان (قليل السكر)",
                "reason": "بناءً على تفضيلك للاتيه والوقت الحالي، ننصحك باتيه دافئ بحليب الشوفان وقليل السكر.",
                "confidence": 0.87,
                "alternatives": ["كابتشينو بحليب الشوفان", "لاتيه مثلج بحليب الشوفان"],
            },
            "usage": Usage(input_tokens=520, output_tokens=210, cached_input_tokens=100),
            "model": "deepseek-chat (demo)",
        },
    },
}


class JebiBrain:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = AsyncOpenAI(
            api_key=settings.deepseek_api_key or "sk-please-configure",
            base_url=settings.deepseek_base_url,
            timeout=settings.ai_timeout_s,
        )

    async def complete(self, prompt: str, *, temperature: float = 0.7,
                       json_mode: bool = True, max_tokens: int = 512,
                       service: str = "recommend", lang: str = "zh") -> tuple[str, Usage, str]:
        """调用 DeepSeek，返回 (文本, usage, model)。

        未配置 DEEPSEEK_API_KEY 时进入演示模式：返回确定性响应，
        但仍携带真实形态的 usage，计费/记账链路照常运行。
        """
        if not self._settings.deepseek_api_key:
            return self._demo(service, lang)
        kwargs: dict = dict(
            model=self._settings.deepseek_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = await self._client.chat.completions.create(**kwargs)
        usage = resp.usage
        u = Usage(
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
            cached_input_tokens=getattr(usage, "prompt_cache_hit_tokens", 0) or 0,
        )
        return resp.choices[0].message.content or "", u, resp.model

    def _demo(self, service: str, lang: str = "zh") -> tuple[str, Usage, str]:
        """演示模式响应（无 API Key 时），按语言返回。"""
        lang_map = DEMO_RESPONSES.get(lang) or DEMO_RESPONSES.get("zh")
        entry = lang_map.get(service)
        if entry is None:
            raise ValueError(f"demo mode has no canned response for service: {service}")
        text = json.dumps(entry["data"], ensure_ascii=False)
        return text, entry["usage"], entry["model"]

    async def recommend(self, payload: dict, inventory: str | None = None, lang: str = "zh") -> dict:
        """消费者个性化推荐：组装 prompt → 调用 → 解析 JSON（响应语言由 lang 决定）。"""
        prompt = prompts.recommend_personalized(
            history=payload.get("history", []),
            weather=payload.get("weather"),
            time_of_day=payload.get("time_of_day"),
            dietary_prefs=payload.get("dietary_prefs", []),
            budget=payload.get("budget"),
            inventory=inventory,
            lang=lang,
        )
        text, usage, model = await self.complete(prompt, temperature=0.7, json_mode=True,
                                                 service="recommend", lang=lang)
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}")
            if start != -1 and end > start:
                data = json.loads(text[start:end + 1])
            else:
                raise ValueError(f"model returned non-JSON: {text[:200]}")
        return {"data": data, "usage": usage, "model": model}