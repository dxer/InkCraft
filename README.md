<div align="center">

<img src="public/logo.svg" width="72" alt="墨匠 InkCraft" />

# 墨匠 InkCraft

**本地优先的现代内容工坊** —— 统一知识库 → 智能选题雷达 → 沉浸创作工坊 → 多平台分发派生 · 内置 MCP Agent 工作流

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Model Context Protocol](https://img.shields.io/badge/MCP-Dual--Mode%20HTTP-00C7B7?logo=anthropic&logoColor=white)
![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5%20trigram-003B57?logo=sqlite&logoColor=white)
![Markdown Editor](https://img.shields.io/badge/Editor-自研%20Markdown-4A6CF7)
![AI SDK v7](https://img.shields.io/badge/AI-Vercel%20AI%20SDK%20v7-4A6CF7)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker&logoColor=white)

</div>

> 「知识管理的目标不是记住，而是把原料锻造成作品。」

墨匠是一个跑在你自己机器上的单容器内容创作工坊：灵感速记与多源素材汇入统一知识库，AI 自动提纯为原子知识卡片并依托**智能选题雷达（Topic Radar）**进行多策略碰撞，创作者在双栏沉浸式画布中通过平台技能一键成稿并派生各渠道分发版本。同时提供**只读双模 MCP HTTP 服务接口**，支持外部 Agent（如 Claude Desktop, Cursor, Dify）直接以你的私有知识库为底座进行思考与协同。数据全部落在本地 SQLite 文件，大模型走 BYOK（自带密钥），不依赖任何第三方 SaaS。

---

## ✨ 功能特性

### 1. 速记与知识卡片提纯

- **秒级速记** —— 首页主输入框，`Ctrl / ⌘ + Enter` 一键入库，支持 Markdown；未写标题时自动截取内容开头作为标题，标签完全由用户交互式管理。
- **统一知识库** —— 多知识库卡片画廊 + 三栏工作台（笔记列表 / 编辑器 / 标签面板，左栏可折叠）；笔记支持多选批量移动/删除、悬停 `···` 菜单，自动保存。
- **自研 Markdown 编辑器** —— 编辑 / 预览双模式、基础排版工具条；**划词 AI 智鉴**：对选中文本一键执行「拓宽 / 质疑 / 评估 / 精校」四维分析，结果可原位替换或驳回重做。
- **原子永久知识卡片 (`/cards`)** —— 内容入库后 AI 自动提纯为 1~3 张符合 Zettelkasten 哲学的原子永久卡片（Permanent Notes）：
  - **断言式标题 (`claim`)**：具有明确因果机制、可证实证伪的客观规律陈述句；
  - **传播 Hook / 切角 (`cut`)**：面向受众的情绪痛点与反常识破题切入点；
  - **底层机制 (`mechanism`)**：深度剖析深层运行因果与逻辑链条；
  - **适用边界 (`boundary`)**：失效场景与大众认知误区；
  - **三视图自由切换**：
    1. **瀑布看板（Masonry Grid View）**：自适应多列流式卡片，适合知识漫游与灵感碰撞；
    2. **紧凑清单（Compact Table View）**：高密度结构化扫描，支持表头排序与批量管理；
    3. **关联拓扑图谱（Knowledge Graph View）**：纯净力导向网络（同源派生/共有概念/启发联想），支持缩放分级渲染（Semantic Zooming）、聚光灯高亮（Spotlight）、右侧卡片精读抽屉与 Shift 多选「串珍珠成文」。
  - 支持在卡片详情或图谱抽屉中一键**「选择技能去创作 ▾」**直达工坊成稿。
- **多源采集** —— 粘贴文本、网页剪藏（Readability 正文提取）、PDF / Markdown / TXT 文件导入、**浏览器插件剪藏**（设置页生成接口密钥，插件端一键采集入库）。

---

### 2. 智能选题雷达（Topic Radar `/topics`）

系统不再做平庸的单篇摘要，而是以**原子知识卡片**为计算单元，通过**三大碰撞策略 + MD5 物理防重指纹**主动策划高传播力选题：

- **三大卡片碰撞策略**：
  - **🔥 反差碰撞（Paradox Mode）**：挖掘认知张力与边界对立的卡片对，打破常识；
  - **🌐 跨界同构（Intersection Mode）**：跨领域标签（`tagA !== tagB`）寻找底层运行机制同构；
  - **📚 专题纵深（Deep Dive Mode）**：同一领域标签下层层递进的逻辑闭环。
- **MD5 物理碰撞指纹排重**：`MD5(sorted_card_ids)` 结合数据库索引，近 30 天内相同卡片组合绝不重复消耗 Token 碰撞。
- **3 选 1 标题矩阵**：
  - `【痛点焦虑型】`：直击目标受众具体困境；
  - `【反常识冲突型】`：颠覆传统认知，制造强烈好奇；
  - `【实操干货型】`：明确给出交付物与操作标准。
- **卡片精准绑定的结构化大纲**：大纲段落精确锚定 `referenced_card_id`，工坊开写时自动高亮引用对应卡片原料。
- **一键开写（Seamless Handoff）**：在看板中点选心仪标题后，一键直通进入 `/workshop` 沉浸创作。

---

### 3. 双模 MCP HTTP 接口与 API 密钥体系 (`/mcp`)

墨匠原生支持 **Model Context Protocol (MCP)** 协议，使外部 Agent（Claude Desktop, Cursor, Dify, LangChain 等）能够以你的私有知识库为第二大脑：

- **统一 `/mcp` 双模通信**：
  - **SSE 长连接模式（`GET /mcp`）**：符合 Anthropic / MCP 官方远程标准，客户端握手后通过 SSE 事件流实时接收消息；
  - **Direct JSON-RPC 模式（`POST /mcp`）**：支持无状态直接请求，发送标准 JSON-RPC 2.0 载荷即时同步返回结果。
- **安全 API 密钥管理**：
  - 在设置页（`/settings` ➔ **MCP 与 API 密钥**）随时新建、查看、一键复制专属密钥（`ink_live_...`）；
  - 密钥经过 SHA-256 散列校验，每次调用自动记录 `last_used_at` 活跃时间。
- **4 大高阶只读 Tools**：
  1. `search_cards_by_query`：**意图加权检索引擎**，对 `claim`(权重 4.0)、`mechanism`(2.5)、`boundary`(2.0)、`tags`(1.5)、正文(1.0) 进行多维度加权打分，返回匹配得分（0~100）与明确命中原因；
  2. `get_card_detail`：传入 `card_id` 获取完整 Markdown 原文与 Frontmatter 元数据；
  3. `list_topics`：读取选题雷达灵感库（含 3 选 1 标题矩阵与绑定卡片 ID）；
  4. `list_recent_works`：读取近期已成稿作品及正文摘要，供 Agent 学习并对齐创作者文风。
- **2 大只读 Resources**：
  - `inkcraft://radar/top-ideas`（当前高分未动笔选题）；
  - `inkcraft://stats/summary`（知识库全局统计摘要）。

---

### 4. 创作工坊与多平台分发

- **双栏沉浸创作工坊 (`/workshop`)** —— 现代单画布工坊：
  - **开屏灵感大厅**：直接从选题库中挑选精选选题，或输入特定方向让 AI 基于相关性加权检索知识库现场碰撞灵感；
  - **左栏原料抽屉**：呈现核心立论快照、选题切角大纲骨架与关联切片素材，支持一键引用到正文；
  - **底栏创作工具坞**：技能选择器（公众号主笔、小红书创作者、知乎主答等）、文风声库选择器与「一键成稿」主按钮；
  - **右侧多平台派生抽屉**：主稿写完后，一键派生转译出小红书/知乎/X Thread/公众号带样式 HTML 版本。
- **成果库 (`/works`)** —— 仅收录正式完成的精品母稿与派生变体，自动提取文章真实标题，展示平台种类徽章，支持分类筛选与一键复制。
- **AI 编辑部 (`/agents`)** —— 集中管理平台创作技能与文生图工位，支持提示词自定义与模型通道绑定。
- **文风语调档案（Voice Profiles）** —— 支持动态增删录入 1~6 篇历史代表作样稿，AI 自动抽取你的行文节奏、语气偏好与修辞约束，起草时一键挂载。

---

## 🏭 端到端内容生产流程

```
速记 · 剪藏 · PDF ──▶ 统一知识库 ──▶ 原子知识卡片提纯（Claim / Cut / Mechanism / Boundary）
                             │
                             ▼
                智能选题雷达（Topic Radar /topics）
  ┌────────────────────────────────────────────────────────┐
  │ 3 大碰撞策略：🔥反差碰撞 · 🌐跨界同构 · 📚专题纵深       │
  │ MD5 物理防重指纹 ➔ 3 选 1 标题矩阵 ➔ 段落锚定卡片大纲   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
                  双栏沉浸创作工坊（/workshop）
                 ┌───────────────────────────┐
                 │ 左栏：原料抽屉与锚定卡片   │
                 │ 中间：流式起草与划词智鉴   │
                 │ 底栏：平台技能与一键成稿   │
                 └─────────────┬─────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
一键派生各平台版本（微信/小红书/X/知乎）       外部 Agent 协同（/mcp 接口）
            │                                     │
            ▼                                     ▼
      成果库（/works）                    Claude / Cursor / Dify 读取知识底座
```

---

## 🗺️ 页面导览

| 路由 | 菜单项 | 说明 |
| --- | --- | --- |
| `/` | 闪念速记 | 主速记输入框 + 标签过滤知识流 |
| `/workshop` | 创作工坊 | 灵感大厅 + 双栏沉浸工作台（原料抽屉 + 画布 + 平台技能成稿 + 派生抽屉） |
| `/knowledge` | 全部笔记 | 多库画廊；进入单库为三栏工作台（笔记列表 + Markdown 编辑器 + 标签/AI 面板） |
| `/cards` | 知识卡片 | 6 维认知提纯卡片三视图（瀑布流 / 表格 / 知识图谱），支持直选技能创作 |
| `/tags` | 标签索引 | 全站标签聚合视图与知识网络索引 |
| `/topics` | 选题雷达 | 3 大策略卡片碰撞、3 选 1 标题矩阵、段落绑定卡片大纲与一键去创作 |
| `/works` | 作品库 | 已完成正式成品的陈列馆（展示真实文章标题与多平台变体） |
| `/agents` | 创作技能 | 平台创作与生图技能名册（文本/图像模态、模型通道分配、提示词自定义） |
| `/settings` | 系统设置 | 多模型通道分配、文风档案多样本克隆、**MCP 与 API 密钥管理**、剪藏扩展、数据导出与迁移 |
| `/mcp` | MCP 端点 | 双模 HTTP 服务端点（支持 SSE 握手与 Direct JSON-RPC 调用） |
| `/login` | 门禁验证 | 配置了 `ACCESS_PASSWORD` 时的登录页 |

---

## 🛠️ 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router · Turbopack）+ React 19 |
| Agent 协议 | Model Context Protocol (MCP) · SSE + Direct JSON-RPC 2.0 双模端点 |
| 编辑器 | 自研 Markdown 编辑器（编辑 / 预览双模式 + 划词 AI 智鉴），marked 渲染 |
| 样式 | Tailwind CSS v4 + shadcn/ui + Radix UI + lucide-react |
| AI | Vercel AI SDK v7 + `@ai-sdk/openai-compatible`（多 Provider / 多模型通道 BYOK） |
| 存储 | better-sqlite3（WAL 模式）+ FTS5 trigram 全文索引（知识库 / 成果双索引）+ 触发器同步 |
| 采集 | `@mozilla/readability` + jsdom（网页剪藏）、pdf-parse（PDF 解析）、marked（Markdown） |

---

## 🚀 快速开始

### 本地开发

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)，数据文件保存在 `data/inkcraft.sqlite`。

首次使用请进入 **系统设置** 页面填写模型端点与密钥（支持任意 OpenAI 兼容服务，如 DeepSeek、SiliconFlow、OpenAI 等）。

---

### 外部 Agent 接入配置（Claude Desktop / Cursor）

在 **设置 ➔ MCP 与 API 密钥** 中新建密钥并复制，然后配置到你的 Agent 客户端中：

#### Claude Desktop 配置 (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "inkcraft": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ink_live_your_api_key_here"
      }
    }
  }
}
```

#### Cursor 配置 (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "inkcraft": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ink_live_your_api_key_here"
      }
    }
  }
}
```

---

### Docker 单容器部署

```bash
docker compose up -d
```

`docker-compose.yml` 默认映射 `3000` 端口，并通过命名卷 `inkcraft_data` 持久化 `/app/data`。公网部署时请修改环境变量：

| 环境变量 | 说明 |
| --- | --- |
| `ACCESS_PASSWORD` | 访问口令，留空则不开启密码门禁 |
| `OPENAI_BASE_URL` | 大模型端点，如 `https://api.deepseek.com/v1` |
| `OPENAI_API_KEY` | 模型密钥（也可部署后在 `/settings` 面板填写） |
| `OPENAI_MODEL` | 默认模型，如 `deepseek-chat` |

---

## ⌨️ 快捷键

| 快捷键 | 作用 |
| --- | --- |
| `⌘K` / `Ctrl K` | 全局搜索（笔记 / 知识库 / 成果） |
| `⌘J` / `Ctrl J` | 知识库问答（可限定分类 / 单库，带引文出处） |
| `⌘↵` / `Ctrl ↵` | 首页速记入库 |
| `⌘S` / `Ctrl S` | 保存笔记（知识库工作台编辑模式） |
| 编辑器选中文字 | 划词 AI 智鉴：拓宽 / 质疑 / 评估 / 精校 |
