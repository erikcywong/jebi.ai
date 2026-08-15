# Jebi Coffee — AI 咖啡产业操作系统（修正版 v2）

[![CI](https://github.com/erikcywong/jebi.ai/actions/workflows/ci.yml/badge.svg)](https://github.com/erikcywong/jebi.ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Ferikcywong.github.io%2Fjebi.ai%2F)](https://erikcywong.github.io/jebi.ai/)
[![Languages: EN / 中文 / العربية](https://img.shields.io/badge/languages-EN%20%2F%20%E4%B8%AD%E6%96%87%20%2F%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9-orange.svg)](web/)

> 品牌/域名：Jebi Coffee（jebi.one）
> 一句话：把 **DeepSeek 大模型当作「电」**，把 **咖啡产业链实体能力当作「载体」**，用 **JBP/JBT Token 计量每一次能力调用**，
> 让平台从「卖咖啡差价」升级为「卖产业能力调用费」。

本仓库是原设计文档的 **修正版实现**，逐条落实评审提出的 **A 硬伤 / B 合规红线 / C 商业判断** 修正。

## 修正要点速览

| 编号 | 原方案问题 | 修正 | 落地位置 |
| --- | --- | --- | --- |
| A1 | DeepSeek 成本用 2024 年老价格（1元/2元 每百万） | 改为现行美元计价口径，成本配置化、可随官方调价更新 | backend/app/config.py |
| A2 | JBP 计价自相矛盾（5 JBP vs 50 JBP）、「1 JBP=1000 推理token」硬挂钩 | 统一计量计价：先按实际 usage 核算成本，再按角色定价；取消固定 token 挂钩 | backend/app/billing.py |
| A3 | 合约 bug：URI 返回空串、违反 CEI、无 tokenId 校验、无防重入 | 三个合约全部修正（可编译、有链上测试） | chain/contracts/*.sol |
| A4 | 「数据回流训练模型」误导（DeepSeek 不拿你的数据训练） | 明确数据飞轮边界：平台自有数据 → 自有特征/风控/微调 | docs/revised-design.md §A4 |
| B1 | JBT 描述为「收益权+分红+挖矿」= 证券属性 | JBT 重新定位为纯 utility（治理+服务费折扣），删除分红承诺 | docs/revised-design.md §B1 |
| B2 | JBP 大额预售触碰预付卡监管 | 充值单笔/余额上限 + 7 天冷静期退款 | backend/app/ledger.py、main.py |
| B3 | 仓单质押缺少登记与背书 | 仓单绑定登记机构号（registration_id）+ 审计/保险要求 | contracts/CoffeeWarehouseReceipt.sol |
| C1 | 「AI 服务费占 30%」早期不现实 | 分阶段收入模型，AI 费随数据飞轮爬坡 | docs/revised-design.md §C1 |
| C2 | 用户为单次推荐付 5 元太贵 | C 端订阅内含 AI 调用；B 端按量计费 | billing.py、main.py |

## 目录结构

    jebi-coffee/
    ├── README.md                       # 本文件
    ├── docs/
    │   ├── revised-design.md           # 修正版完整设计方案（A/B/C 逐条回应）
    │   └── franchisee-manual.md      # 加盟商手册修订版（v2）
    ├── web/                              # 品牌官网 + 业务演示台（X.com 风格暗色主题）
    │   ├── index.html                     # 首页（首次访问弹出语言选择）
    │   ├── franchise.html                 # 加盟商页
    │   ├── demo.html                      # 业务演示台：对接真实后端 API
    │   ├── architecture.html              # 技术架构页
    │   └── assets/                        # 设计系统 CSS + JS + i18n 词库
    ├── chain/                            # Hardhat 工程（合约唯一规范位置）
    │   ├── contracts/                    # Solidity 源码（EVM 兼容，参考实现）
    │   │   ├── JebiPoint.sol             # JBP 积分台账（联盟链存证，非代币）
    │   │   ├── CoffeeWarehouseReceipt.sol# 咖啡豆数字仓单 ERC-1155（URI 已修正）
    │   │   └── RoastPackageToken.sol     # 烘焙包服务凭证 ERC-721（CEI/防重入已修正）
    │   ├── hardhat.config.js             # 编译/测试/网络配置
    │   ├── scripts/deploy.js             # 部署：JBP→仓单→烘焙包→接线+示例数据
    │   └── test/roastPackage.test.js     # 链上逻辑测试
    └── backend/                        # Jebi Brain API（FastAPI + DeepSeek）
        ├── app/
        │   ├── config.py               # 全部价格/合规参数（环境变量可覆盖）
        │   ├── billing.py              # 统一计量计价核心（修正 A2 的核心）
        │   ├── ledger.py               # JBP 台账 + AI 用量日志 + 仓单/烘焙包台账（SQLite）
        │   ├── prompts.py              # 提示词模板库（推荐/补货/定价/品鉴）
        │   ├── ai_service.py           # DeepSeek 接入层（OpenAI 兼容端点）
        │   ├── models.py               # Pydantic 请求/响应模型
        │   └── main.py                 # API 网关：推荐 + 报价 + 余额 + 充值 + 退款 + 对账
        ├── tests/test_billing.py       # 统一计价回归测试（pytest 或直接运行）
        ├── requirements.txt
        └── .env.example

## 在线预览（GitHub Pages）

三语官网（首页 / 加盟商 / 业务演示 / 技术架构）已由 GitHub Pages 自动部署：

- **https://erikcywong.github.io/jebi.ai/**

> 说明：品牌页与加盟页可完全静态访问；**业务演示台**需要真实后端（JBP 计量计费），请按「快速开始」在本地启动后访问。首次打开首页会弹出语言选择弹窗（English / 简体中文 / العربية السعودية）。

## 站点结构（分区子页 + 联系页）

导航下拉菜单的每个分区均有独立子页（如 concept.html / ai-services.html / price-quote.html …），并新增 **Contact us** 菜单：

- WhatsApp：+852 9318 8252（[wa.me/85293188252](https://wa.me/85293188252)）
- WeChat：+86 158 0022 2338（点击复制）
- Email：erik.wong@napell.bio

生成方式：修改分区内容后运行 `node scripts/gen_subpages.js` 可重新生成全部子页。

## 多语言（EN / 简体中文 / العربية السعودية）

- 首次打开首页弹出**语言选择弹窗**（居中覆盖层）；右上角 🌐 按钮可随时切换，页脚也有切换入口；
- 全站 UI、按钮、提示、错误消息、动态内容（含演示台推荐结果）均已翻译，阿拉伯语自动切换 RTL 布局；
- 词库位于 web/assets/js/i18n-*.js，页面通过 data-i18n 属性取词；
- **覆盖率校验**：`node scripts/check_i18n.js`（当前 388 键 × 3 语言，0 缺失）；
- 推荐接口支持 `lang` 字段（en/zh/ar），演示数据与真实 DeepSeek prompt 均按语言输出。

## 快速开始（网站 + API 一条命令）

    cd backend
    .venv\Scripts\activate        # 首次需先创建 venv 并安装依赖（见下）
    uvicorn main:app --app-dir app --port 8000

打开 http://127.0.0.1:8000 即是完整网站（首页 / 加盟商 / 业务演示 / 技术架构）。
同一进程同时提供 API 与静态页面；未配置 DEEPSEEK_API_KEY 时，推荐接口使用内置演示数据（计量计费逻辑不变）。

**首次准备环境**：

    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env   # 可选：填入 DEEPSEEK_API_KEY 后推荐走真实 DeepSeek

## 快速开始（后端开发模式）

    cd backend
    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env   # 填入 DEEPSEEK_API_KEY
    uvicorn main:app --app-dir app --reload --port 8000

无 API Key 也可启动，/healthz、报价、余额、充值、对账接口可正常演示；推荐接口会返回 500 MODEL_ERROR。

### 演示请求

    # 1) 充值（合规上限内）
    curl -X POST http://127.0.0.1:8000/api/v1/users/u_001/topup \
      -H "Content-Type: application/json" -H "X-Jebi-User: u_001" \
      -d '{"user_id":"u_001","amount_jbp":1000}'

    # 2) B 端预报价（不扣费）
    curl -X POST http://127.0.0.1:8000/api/v1/billing/quote \
      -H "Content-Type: application/json" -H "X-Jebi-Role: business" \
      -d '{"user_id":"u_001","store_id":"s_001","history":["Latte","Cold Brew"]}'

    # 3) 推荐（B 端按量扣 JBP；C 端订阅应收 0）
    curl -X POST http://127.0.0.1:8000/api/v1/recommend/personalized \
      -H "Content-Type: application/json" -H "X-Jebi-User: u_001" -H "X-Jebi-Role: business" \
      -d '{"user_id":"u_001","store_id":"s_001","location":"深圳南山","weather":"阴天 28°C","time_of_day":"afternoon","history":["Latte","Cold Brew"],"dietary_prefs":["plant-milk"],"budget":30}'

    # 4) 对账（累计成本 vs 累计应收，与 DeepSeek 账单比对）
    curl http://127.0.0.1:8000/api/v1/admin/usage/summary

### 测试

    cd backend
    python tests/test_billing.py    # 无需第三方依赖
    # 或
    pytest tests/ -q

## 合约部署（Hardhat）

    cd chain
    npm install
    npx hardhat test                 # 链上逻辑测试
    npx hardhat node                 # 本地节点（另开终端）
    npx hardhat run scripts/deploy.js --network localhost

部署顺序：

1. 部署 JebiPoint（JBP 积分台账）→ 记录地址 JBP_ADDR
2. 部署 CoffeeWarehouseReceipt（仓单）→ CWR_ADDR
3. 部署 RoastPackageToken，构造参数传入 JBP_ADDR
4. 调用 roastPackage.setWarehouse(CWR_ADDR) 接通「烘焙履行 → 仓单铸造」

> 国内部署建议：联盟链（蚂蚁链/长安链）只上 JBP 积分与仓单存证，**不发行可交易代币**；
> 海外 JBT 属另一套合约（治理+utility），见 docs/revised-design.md §B1。

## 免责声明

本仓库为**技术参考实现**，不构成任何投资建议或合规保证。境内主体仅可使用积分制（JBP），
禁止发行/变相发行加密货币；任何涉及收益权、分红的通证发行均需另行取得牌照并遵循当地证券法。