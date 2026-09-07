<div align="center">

<img src="public/logo.svg" width="72" alt="墨匠 InkCraft" />

# 墨匠 InkCraft

**本地优先的现代内容工坊** —— 统一知识库 → 平台创作技能直出 / 选题灵感库 → 一键多平台派生

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5%20trigram-003B57?logo=sqlite&logoColor=white)
![Markdown Editor](https://img.shields.io/badge/Editor-自研%20Markdown-4A6CF7)
![AI SDK v7](https://img.shields.io/badge/AI-Vercel%20AI%20SDK%20v7-4A6CF7)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker&logoColor=white)

</div>

> 「知识管理的目标不是记住，而是把原料锻造成作品。」

墨匠是一个跑在你自己机器上的单容器内容创作工坊：灵感速记与多源素材汇入统一知识库，AI 自动提纯为高价值知识卡片并周期挖掘精选选题，创作者在双栏沉浸式画布中通过平台技能（微信公众号、小红书、知乎、X/即刻短文、通用母稿）一键成稿，再一键派生各渠道分发版本。数据全部落在本地 SQLite 文件，大模型走 BYOK（自带密钥），不依赖任何第三方 SaaS。

---

## ✨ 功能特性

### 速记与整理

- **秒级速记** —— 首页主输入框，`Ctrl / ⌘ + Enter` 一键入库，支持 Markdown；未写标题时自动截取内容开头作为标题，标签完全由用户手动交互式管理（交互式气泡增删，不搞多余干扰）
- **统一知识库** —— 多知识库卡片画廊 + 三栏工作台（笔记列表 / 编辑器 / 标签面板，左栏可折叠）；笔记支持多选批量移动/删除、悬停 `···` 菜单（导出 / 移动 / 移除 / 删除），自动保存
- **自研 Markdown 编辑器** —— 编辑 / 预览双模式、基础排版工具条；**划词 AI 智鉴**：对选中文本一键执行「拓宽 / 质疑 / 评估 / 精校」四维分析，结果可原位替换或驳回重做
- **高价值原子知识卡片 (`/cards`)** —— 内容入库后 AI 自动提纯为 1~3 张符合 Zettelkasten 哲学的原子永久知识卡片（Permanent Notes）：
  - **断言式标题**（具有明确因果机制、可证实证伪的客观规律陈述句）
  - **自媒体传播 Hook**（面向受众的情绪痛点、反常识切入点与爆款引子）
  - **核心机制与底层逻辑**（无损输入长文深度剖析，揭示深层运行因果）
  - **适用边界与认知陷阱**（失效场景与行业大众常见误区）
  - **最小可行落地行动**（具备参数与标准的具体操作指令）
  - **受控标签与关联线索**（继承源笔记权威领域标签，预置潜在关联线索）
  - **三视图自由切换**：
    1. **瀑布看板（Masonry Grid View）**：自适应多列流式卡片，适合知识漫游与灵感碰撞；
    2. **紧凑清单（Compact Table View）**：高密度结构化扫描，支持表头排序与批量管理；
    3. **关联拓扑图谱（Knowledge Graph View）**：纯净力导向网络（同源派生/共有概念/启发联想），支持缩放分级渲染（Semantic Zooming）、聚光灯高亮（Spotlight）、右侧卡片精读抽屉（Graph Drawer）、平滑漫游（Fly to Node）与 Shift 多选「串珍珠成文」。
  - 支持在卡片详情或图谱抽屉中一键**「选择技能去创作 ▾」**直达工坊成稿
- **知识库工作台右侧卡片面板 (`/knowledge/[id]`)** —— 选中笔记实时联动展示该笔记萃取的全部原子知识卡片，支持原地重新提炼、一键复制与直达工坊二次创作。
- **多源采集** —— 粘贴文本、网页剪藏（Readability 正文提取）、PDF / Markdown / TXT 文件导入、**浏览器插件剪藏**（设置页生成接口密钥，插件端一键采集入库）

### 选题库与灵感挖掘

- **智能选题库 (`/topics`)** —— 系统每小时增量扫描新收录笔记，自动策划高价值平台选题：
  - **单篇笔记一对一**：每篇新笔记仅提纯 1 个最适配其内容特质的黄金选题，绝不在单篇笔记上泛滥发散；
  - **跨笔记张力碰撞**：当有 2 篇及以上笔记时，额外合成 1 个跨界融合大选题；
  - **0 冗余 Token 消耗**：周期内若无新收录笔记，自动跳过，消耗 0 Token；
  - **严格防重与评分系统**： Prompt 级注入历史已有 80 条标题进行负向排重；每条选题配有综合推荐分（85~98分）与评级标签（`🔥 爆款首选`、`💡 深度思辨`、`📌 痛点爆款`、`⚡ 高密穿透`）；
  - **多维筛选与排序**：支持按评分最高、最新创建排序，支持按平台与来源（⚡ 周期挖掘 / 🎨 工坊生成）精准筛选。

### 创作与分发

- **双栏沉浸创作工坊 (`/workshop`)** —— 告别繁琐阶梯工位，升级为现代单画布工坊：
  - **开屏灵感大厅**：直接从选题库中挑选精选选题，支持「换一批」轮换浏览（每批 4 条），或输入特定方向让 AI 基于相关性加权检索知识库现场碰撞灵感；
  - **左栏原料抽屉**：呈现核心立论快照、选题切角大纲骨架与关联切片素材，支持一键引用到正文；
  - **底栏创作工具坞**：技能选择器（公众号主笔、小红书创作者、知乎主答等，仅显示已启用技能）、文风声库选择器与「一键成稿」主按钮；
  - **右侧多平台派生抽屉**：主稿写完后，无需跳出页面，一键派生转译出小红书/知乎/X Thread/公众号带样式 HTML 版本。
- **AI 编辑部 (`/agents`)** —— 集中管理平台创作技能、文生图技能与工坊工位：
  - 预置 5 大平台创作技能（微信公众号、小红书笔记、知乎回答、X/即刻短文、通用母稿）与文生图专家；
  - 明确标注 `📝 生文` / `🎨 生图` 模态属性；
  - 专属模型通道智能选择（自动列出在设置中配置的文本/生图模型与常用预设）；
  - 每张卡片支持一键「已启用 / 已禁用」切换，只有启用的技能才会在创作流中出现；
  - 人格设定、System Prompt 提示词与模型 Temperature 均可自由定制。
- **成果库 (`/works`)** —— 仅收录正式创作完成的精品母稿与派生变体，自动提取文章真实标题，展示平台种类徽章，支持按产出种类（微信公众号、知乎、小红书等）动态聚合筛选。
- **文风声库** —— 采样你的历史文字，沉淀可复用的「文风语调档案」（Voice Profiles），让 AI 拟合你的真实口吻。

### 基础体验

- **全局搜索** —— `⌘K / Ctrl+K` 命令面板，一次检索笔记 / 知识库 / 成果；SQLite FTS5 trigram 分词（知识库 + 成果双索引），中文子串检索可用
- **门禁与 BYOK** —— `ACCESS_PASSWORD` 访问口令；多模型通道自由分配（任意 OpenAI 兼容端点，可配多 Provider / 模型通道映射），密钥存本地，设置面板可连通性测试
- **数据导出与备份** —— 笔记 Markdown 导出；SQLite 一致性快照导出（下载后替换 `data/inkcraft.sqlite` 即可整体恢复）
- **明暗双主题** —— 全站单色克制美学，品牌印章 Logo 随主题自动反色

---

## 🏭 内容生产流程

```
速记 · 剪藏 · PDF ──▶ 统一知识库 ──▶ 知识卡片萃取（核心洞察 + 边界 + 零件 + 金句）
                             │
                             ▼
     每小时增量挖掘 ──▶ 选题库（评分 · 爆款切角 · 递进大纲）
                             │
                             ▼
                  双栏沉浸工作台（/workshop）
                 ┌───────────────────────────┐
                 │ 左栏：原料抽屉与选题切角   │
                 │ 中间：流式起草与划词智鉴   │
                 │ 底栏：平台技能与一键成稿   │
                 └─────────────┬─────────────┘
                               │
                               ▼
     一键派生 ──▶ 微信公众号 · 小红书 · 知乎 · X Thread ──▶ 成果库（/works）
```

---

## 🗺️ 页面导览

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 · 速记流 | 主速记输入框 + 标签过滤的知识流 |
| `/knowledge` | 知识库 | 多库卡片画廊；进入单库为三栏工作台（笔记列表 + Markdown 编辑器 + 标签 / AI 面板） |
| `/cards` | 知识卡片 | 6 维原子知识卡片画廊与检索；详情弹框 Markdown 渲染，支持复制与直选技能去创作 |
| `/topics` | 选题库 | 周期挖掘与工坊沉淀的选题看板，带综合推荐评分、平台标签、大纲骨架与一键去创作 |
| `/workshop` | 创作工坊 | 灵感大厅（选选题）+ 双栏沉浸工作台（原料抽屉 + 画布 + 平台技能一键成稿 + 多平台派生） |
| `/works` | 成果库 | 已完成正式成品的陈列馆（按内容种类分类筛选与展示真实文章标题） |
| `/agents` | 编辑部 | 平台创作与生图技能名册（生文/生图模态、模型通道、启用/禁用、提示词自定义） |
| `/tags` | 标签 | 全站标签聚合视图 |
| `/memory` | 创作者记忆 | 思考轨迹统计 + 历史闪念时光流 |
| `/settings` | 设置 | 多模型通道分配、文风档案、剪藏插件密钥、数据导出与备份 |
| `/login` | 门禁验证 | 配置了 `ACCESS_PASSWORD` 时的登录页 |

---

## 🛠️ 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router · Turbopack）+ React 19 |
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

打开 [http://localhost:3000](http://localhost:3000)，数据文件位于 `data/inkcraft.sqlite`。

首次使用请进入 **设置** 页面填写模型端点与密钥（任何 OpenAI 兼容服务均可，如 DeepSeek、SiliconFlow、OpenAI 等）。

### Docker 单容器部署

```bash
docker compose up -d
```

`docker-compose.yml` 默认映射 `3000` 端口，并通过命名卷 `inkcraft_data` 持久化 `/app/data`。公网 VPS 部署时请修改环境变量：

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

---

## 📁 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页 · 速记流
│   ├── layout.tsx            # 全局布局（侧边导航 + 问答对话框）
│   ├── knowledge/            # 知识库画廊 + [id] 三栏工作台
│   ├── cards/                # 知识卡片画廊（6 维认知提纯 · 直选技能创作）
│   ├── topics/               # 智能选题库（综合评分 · 平台标签 · 大纲骨架 · 去创作）
│   ├── workshop/             # 创作工坊（灵感大厅 + 双栏沉浸工作台）
│   ├── works/                # 成果库（已完成母稿与派生作品展示）
│   ├── agents/               # AI 编辑部（平台创作技能 · 生文/生图模态 · 通道分配）
│   ├── memory/ tags/ settings/ login/
│   └── api/                  # 包含 topics · workshop · cards · pipeline · …
├── components/
│   ├── editor/               # 自研 Markdown 编辑器（划词 AI 智鉴）
│   ├── workshop/             # 工作台画布 · 原料抽屉 · 灵感大厅 · 多平台派生抽屉
│   ├── ui/                   # shadcn / Radix 基础组件
│   └── sidebar-nav.tsx · mobile-nav.tsx · global-search-dialog.tsx · badges.tsx
└── lib/
    ├── db.ts                 # SQLite · FTS5 trigram ×2 · 触发器与迁移
    ├── ai.ts                 # AI SDK 封装 · BYOK · 多通道映射
    ├── pipeline.ts           # 工坊创作流与项目管理
    ├── topics.ts             # 选题库核心逻辑（查重 · 每小时增量挖掘 · 评分）
    ├── cards.ts · card-md.ts # 知识卡片（6 维提纯结构 · 萃取提示词）
    ├── search.ts             # 统一检索原语（FTS5 + LIKE 降级）
    ├── zhijian.ts            # 智鉴四维分析（拓宽 / 质疑 / 评估 / 精校）
    ├── settings.ts · auth.ts # BYOK 模型通道 · 访问门禁
    └── test/                 # node:test 单元测试集（21 项测试）
```

---

## 🧪 测试

```bash
pnpm test   # node:test + tsx（chunkText / 检索原语 / 选题库 / settings 迁移等）
```

---

## 🎞️ 品牌标识

「点墨成章」：一枚圆角方印（匠 · 雕琢），内嵌负空间墨滴（墨 · 想法），墨滴落下凝成一道墨条（章 · 内容块）——把一滴想法，锻造成一篇文章。纯矢量单色，随明暗主题自动反色。
