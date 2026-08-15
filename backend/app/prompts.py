"""Jebi Brain 提示词模板库。

所有模板要求模型输出固定 JSON 结构，便于解析、计量与审计（修正点 A2：结构化输出）。
模板只包含「当次」业务上下文，不携带历史训练数据（修正点 A4：数据飞轮边界）。
"""


def recommend_personalized(history, weather, time_of_day, dietary_prefs, budget, inventory, lang: str = "zh") -> str:
    """多语言推荐模板：语言决定 prompt 与输出语言（en / zh / ar）。"""
    if lang == "en":
        return f"""You are Jebi Coffee's professional barista and recommendation expert. Recommend one coffee based on the information below and give a reason.
Requirements:
- Output JSON only, nothing else
- Structure: {{"recommendation": "...", "reason": "...(no more than 50 words)", "confidence": 0.0-1.0, "alternatives": ["...", "..."]}}

User history: {history or "new user"}
Current weather: {weather or "unknown"}
Time of day: {time_of_day or "unknown"}
Dietary preferences: {dietary_prefs or "none"}
Budget limit: {budget if budget else "no limit"} CNY
Store inventory: {inventory or "unknown"}
"""
    if lang == "ar":
        return f"""أنت خبير باريستا وتوصيات القهوة في Jebi Coffee. يرجى التوصية بفنجان قهوة واحد بناءً على المعلومات التالية مع ذكر السبب.
المتطلبات:
- يجب أن يكون الإخراج JSON فقط دون أي محتوى آخر
- البنية: {{"recommendation": "...", "reason": "...(بحد أقصى 50 كلمة)", "confidence": 0.0-1.0, "alternatives": ["...", "..."]}}

سجل المستخدم: {history or "مستخدم جديد"}
الطقس الحالي: {weather or "غير معروف"}
الوقت: {time_of_day or "غير معروف"}
التفضيلات الغذائية: {dietary_prefs or "لا شيء"}
الحد الأقصى للميزانية: {budget if budget else "بدون حد"} يوان
مخزون المتجر: {inventory or "غير معروف"}
"""
    return f"""你是 Jebi Coffee 的专业咖啡师与推荐算法专家。请基于以下信息推荐一杯咖啡并给出理由。
要求：
- 输出必须是 JSON，不要输出其他任何内容
- 结构：{{"recommendation": "...", "reason": "...(不超过50字)", "confidence": 0.0-1.0, "alternatives": ["...", "..."]}}

用户历史偏好：{history or "新用户"}
当前天气：{weather or "未知"}
时段：{time_of_day or "未知"}
饮食偏好：{dietary_prefs or "无"}
预算上限：{budget if budget else "不限"} 元
门店库存：{inventory or "未知"}
"""


def restock_forecast(history_sales, promotions, holidays, lead_time_days) -> str:
    return f"""你是咖啡供应链计划专家。基于以下数据预测未来 7 天门店需求。
输出 JSON：{{"daily_forecast": [{{"date": "...", "qty_cups": 0, "bean_kg": 0}}], "reorder": {{"date": "...", "bean_kg": 0}}, "note": "..."}}

历史销量(近30天)：{history_sales}
促销计划：{promotions or "无"}
节假日：{holidays or "无"}
补货提前期：{lead_time_days} 天
"""


def dynamic_pricing(cost_cny, inventory, competitor_price, time_of_day, sales_speed) -> str:
    return f"""你是零售定价专家。基于以下信息给出最优价格区间。
输出 JSON：{{"suggested_price_cny": 0.0, "min_price_cny": 0.0, "max_price_cny": 0.0, "reason": "..."}}

成本价：{cost_cny} 元
库存：{inventory}
竞品价：{competitor_price or "未知"}
时段：{time_of_day}
近期销售速度：{sales_speed or "未知"}
"""


def quality_inspection(bean_desc, cup_data) -> str:
    return f"""你是 SCA 认证咖啡品鉴师。基于杯测数据评估咖啡豆品质。
输出 JSON：{{"sca_score": 0, "defects": ["..."], "grade": "specialty|premium|commercial", "summary": "..."}}

生豆信息：{bean_desc}
杯测数据：{cup_data}
"""