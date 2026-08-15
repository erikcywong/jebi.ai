# Jebi Coffee 修正版设计方案（v2.0）

> 对应评审结论：A 硬伤（A1 成本模型 / A2 计价矛盾 / A3 合约 bug / A4 数据飞轮边界）、
> B 合规红线（B1 JBT 证券属性 / B2 预付卡 / B3 仓单登记 / B4 数据合规）、
> C 商业判断（C1 收入分阶段 / C2 订阅与按量 / C3 动态计价 / C4 域名资质）。

本文与代码仓库一一对应：docs/revised-design.md 讲「为什么」，backend 与 contracts 讲「怎么做」。

---

## A. 硬伤修正

### A1 成本模型重算（DeepSeek 现行计价）

原方案写「约 1 元/百万输入、2 元/百万输出」——这是 2024 年的人民币老价格，已失效。

**现行口径（参考，以官方价格页 https://api-docs.deepseek.com/quick_start/pricing 为准）**：

| 模型 | 输入（未命中缓存） | 输入（命中缓存） | 输出 |
| --- | --- | --- | --- |
| deepseek-chat | ~$0.27/M ≈ 1.95 元/M | ~$0.07/M ≈ 0.51 元/M（约 3 折） | ~$1.10/M ≈ 7.95 元/M |

注意：DeepSeek 已转美元计价、分模型定价、多次调价，并不断推出新模型（如 V4-Pro-0813 等）。
因此本方案 **不把价格写死在代码里**，全部参数化（PRICE_INPUT_PER_M_CNY / PRICE_OUTPUT_PER_M_CNY / PRICE_CACHE_HIT_RATIO），
随官方调价更新环境变量即可，无需改业务代码。

**成本公式**（与官方 usage 字段一一对应，缓存命中输入按比例折算）：

    cost_cny = input_tokens/1e6 * P_in
             + cached_input_tokens/1e6 * P_in * cache_hit_ratio
             + output_tokens/1e6 * P_out

实现：backend/app/billing.py 的 deepseek_cost_cny()。

### A2 统一计量计价（消除「5 JBP vs 50 JBP」矛盾）

原方案两处计价冲突：模块一写 5 JBP/次，API 文档写 50 JBP/次；且「1 JBP = 1000 推理 token」
把法币锚定积分与可变模型成本硬挂钩，逻辑不自洽。

**修正原则**：

1. **先计量、后计价**：每次调用先按实际 usage 算出 DeepSeek 成本（人民币），再按调用方角色定价；
2. **取消固定 token 挂钩**：不再声称「1 JBP = N 推理 token」，JBP 只锚定法币（1 JBP = 0.1 元）用于内部记账；
3. **角色定价策略**（同一 usage，口径唯一、可审计）：

| 角色 | 定价策略 | 说明 |
| --- | --- | --- |
| consumer_bundle（C 端订阅） | 应收 0 JBP；成本 × 3 计入订阅定价模型 | AI 推荐包含在 99 元/月订阅内，不另收费，避免「推荐收 5 元」的糟糕体验 |
| consumer_payg（C 端按量） | 成本 × 3，保底 10 JBP（1 元） | 非订阅用户的轻量入口 |
| business（B 端：加盟商/供应商/开发者） | 成本 × 5 毛利，保底 50 JBP（5 元） | 保底价覆盖最低客单成本与基础设施；大批量调用按实际用量线性增长 |

4. **对账闭环**：每次调用写入 ai_usage_logs（输入/输出/缓存 token、成本、应收），
与 DeepSeek 官方账单比对（GET /api/v1/admin/usage/summary），杜绝计费漂移。

实现：backend/app/billing.py 的 quote_call()，测试见 backend/tests/test_billing.py。

### A3 智能合约修正清单

| 合约 | 原 bug | 修正 |
| --- | --- | --- |
| CoffeeWarehouseReceipt | uri() 覆写后默认返回**空字符串**，ERC-1155 元数据解析失败 | 有自定义 URI 返回自定义值，否则回退 baseURI + id + .json |
| RoastPackageToken.purchasePackage | 状态更新**前**调用外部 JBP transferFrom（违反 checks-effects-interactions）；无 tokenId 存在性校验 | 先置状态与持有关系，再划转 JBP；增加 packageExists 校验与 nonReentrant 防重入 |
| RoastPackageToken.fulfillPackage | 只改状态，未落地「铸造咖啡豆仓单」 | 通过 IWarehouseReceipt.mintForRoast 铸造对应克数仓单（CEI：状态先行，外部调用在后） |
| RoastPackageToken.cancelPackage | 退款路径顺序不严谨 | 先置 Cancelled 再退款再销毁；退款失败整体回滚 |
| RoastPackageToken 资金流 | 购买款划给 owner() EOA，退款时合约无余额可退 | **合约托管**：购买款入 address(this)，退款由托管支付，平台经 withdrawJBP 提走 |
| CoffeeWarehouseReceipt 铸造权限 | 仅 onlyOwner，烘焙包合约无法代铸 | 改为 **minter 白名单**：授权 RPT 履行后铸造仓单，平台管理员铸原始批次 |
| JebiPoint | 定位不清，易被认定为变相发行 | 注释明确「积分台账、不可二级交易、不可双向兑换」；仅白名单 minter 可铸/销，全部带业务原因（可审计） |

### A4 数据飞轮边界（DeepSeek 不拿你的数据训练）

原方案「所有调用产生的数据（脱敏后）回流训练模型」表述误导——DeepSeek API 默认**不**使用你的数据训练。

**修正后的飞轮**：

    [门店/消费者/供应链埋点数据]
            |（脱敏：去手机号/身份证；PIPL 告知同意；境内存储）
            v
    [平台自有数据仓库] ──► 特征工程 / 规则引擎 / 风控模型
            |                 └─► 可选：开源模型 LoRA 微调出 Jebi-Small（自托管）
            v
    [Jebi Brain 服务] ──► 每次推理调用 DeepSeek API（只传当次业务上下文，不沉淀训练）

- 数据飞轮 = **平台自己的数据资产**，与 DeepSeek 调用解耦；
- 调用 DeepSeek 时只传「当次」上下文（用户脱敏 ID、历史偏好、天气、库存），不批量回传训练；
- 遵守 DeepSeek 平台条款与《个人信息保护法》：告知同意、目的限定、删除权（用户可要求删除画像）。

---

## B. 合规红线修正

### B1 JBT 重新定位：纯 utility，删除证券化表述

原方案 JBT 同时写了「平台收益权 + 治理权 + 固定总量 + 贡献挖矿 + 平台利润分红」——
收益权 + 分红 + 挖矿凑齐即触发 Howey 测试 / 香港 SFC「代币即证券」判定，与「功能性通证」自相矛盾。

**修正后 JBT 定位**：

| 属性 | 允许 | 不允许 |
| --- | --- | --- |
| 用途 | 治理投票、服务费折扣、生态内支付媒介 | 承诺分红、收益分成、回购承诺 |
| 发行 | 基金会公开出售（纯 utility 定价） | 以「投资回报」话术募资 |
| 挖矿 | 流动性/贡献激励（描述为「服务奖励」） | 描述为「挖矿产生收益权」 |
| 二级市场 | 合规交易所流通（视当地法规） | 境内任何形式交易 |

若未来确需向持有人分配利润，**必须切换为证券型路径**（STO / 持牌发行），与 utility 体系完全隔离，
另行法务与牌照评估。

### B2 单用途预付卡合规（JBP）

JBP 大额预售受《单用途商业预付卡管理办法》约束。修正：

1. **单笔充值上限**：10,000 JBP（1,000 元）；
2. **单账户余额上限**：50,000 JBP（5,000 元）——压住备案门槛（发卡超规模须向商务主管部门备案）；
3. **7 天冷静期退款**：充值后 7 天内可无理由退（实现见 topup/refund 接口）；
4. **资金存管**：预收资金按比例存管（备案企业 40% / 规模发卡 20%，按所在地规则），接入银行存管；
5. 积分不可双向兑换法币、不可场外交易（合约与运营条款双重约束）。

### B3 仓单 Token 化：登记 + 审计 + 保险

- 每张仓单绑定**登记机构登记号**（如中仓登 registration_id），仓单合约 mint 时写入；
- 实物由第三方仓储 + 保险背书；平台对 AI 鉴定结果承担过错责任，不承担市场风险；
- 仓单质押融资须在登记机构完成质押登记，防止重复质押；
- 台账侧：warehouse_receipts 表记录 registration_id / weight / quality_score（AI 鉴定结果）。

### B4 数据合规清单

| 项 | 要求 | 落地 |
| --- | --- | --- |
| 告知同意 | 收集画像/订单/位置前取得同意，目的限定 | 隐私政策 + SDK 弹窗（产品侧） |
| 最小化 | 用户 ID 脱敏（哈希），不传手机号 | backend 全链路使用 user_id 哈希 |
| 境内存储 | 境内用户数据存国内服务器，DeepSeek 用国内端点 | 部署架构约束 |
| 日志 | AI 调用日志保留 180 天用于风控对账，到期删除 | ai_usage_logs + 清理任务 |
| 删除权 | 用户可要求删除画像与历史 | 提供删除接口（产品侧） |

---

## C. 商业判断修正

### C1 分阶段收入模型（AI 费随飞轮爬坡）

原方案「AI 服务费占 30%」在早期不现实——没有数据积累，AI 价值无法兑现。改为三阶段：

| 阶段 | 门店规模 | 供应链差价/门店分成 | AI 服务费 | 仓单/碳积分等流转费 | 数据增值 |
| --- | --- | --- | --- | --- | --- |
| 一（0-6 月） | 2-3 家直营 | 70% | 5% | 15% | 10% |
| 二（6-18 月） | 50 家加盟 | 55% | 20% | 15% | 10% |
| 三（18-36 月） | 海外+生态 | 40% | 30% | 20% | 10% |

阶段一的核心是**验证模型精度与数据闭环**，收入靠实体业务；AI 收入是「电费」，先有电表（计量）才有电费。

### C2 订阅内含 AI 调用，按量计费面向 B 端

- C 端：99 元/月订阅含 30 杯 + 不限次个性化推荐（AI 成本已计入订阅定价，用户零感知）；
- B 端（加盟商/供应商/开发者）：按 API 用量计费（成本 × 5，保底 50 JBP/次），走企业结算；
- C 端不再为单次推荐单独付费——解决「5 元一次推荐」的定价失误。

### C3 动态计价替代固定 Token 挂钩

原方案「1 JBP = 1000 推理 token」与「JBP 锚定法币」自相矛盾（模型成本会变，法币锚定不会）。
修正：JBP 只锚定法币；AI 调用价格 = f(实际 usage, 角色策略)，随模型调价自动传导，平台毛利恒定。

### C4 域名与资质提醒

- jebi.one 目前公开渠道查不到对应咖啡平台（搜索命中的 Jebi 是 Mac 终端等无关产品），
  需确认域名注册状态，并尽早完成 ICP 备案（境内）与等保三级；
- 涉及支付、积分、跨境、供应链金融，须前置取得/对接：支付牌照（或通道）、预付卡备案、
  网络经营许可、食品安全许可等，逐项由法务确认。

---

## 修订后的 Token 流转闭环

    用户支付法币 ─► 充值 JBP（单笔/余额上限 + 冷静期退款）
                          │
                          v
    平台内消费：咖啡订阅 / AI 调用 / 烘焙包 / 仓单
                          │
                          v
    每次 AI 调用：先按 usage 计成本 ─► 按角色定价 ─► 扣 JBP ─► 写 ai_usage_logs（对账）
                          │
                          v
    服务提供方（烘焙厂/庄园/AI 引擎）获得 JBP 结算 ─► 支付平台服务费 / 提现（仅 B 端合规通道）
                          │
                          v
    平台收 1-3% 流转手续费 + 数据/流动性激励（JBP 形式，境内无二级市场）

## 代码 ↔ 修正点映射

| 修正点 | 代码文件 |
| --- | --- |
| A1 成本配置化 | backend/app/config.py |
| A2 统一计价 | backend/app/billing.py、backend/tests/test_billing.py |
| A3 合约修正 | chain/contracts/JebiPoint.sol、chain/contracts/CoffeeWarehouseReceipt.sol、chain/contracts/RoastPackageToken.sol |
| A4 飞轮边界 | docs/revised-design.md §A4（本文） |
| B2 充值限额/退款 | backend/app/ledger.py、backend/app/main.py |
| B3 仓单登记号 | chain/contracts/CoffeeWarehouseReceipt.sol、backend/app/ledger.py |
| C2 订阅/按量定价 | backend/app/billing.py |