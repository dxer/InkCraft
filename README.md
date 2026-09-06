<div align="center">

<img src="public/logo.svg" width="72" alt="墨匠 InkCraft" />

# 墨匠 InkCraft

**本地优先的现代内容工坊** —— 统一知识库 → 三步装配流 → 分发转译

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5%20trigram-003B57?logo=sqlite&logoColor=white)
![Markdown Editor](https://img.shields.io/badge/Editor-自研%20Markdown-4A6CF7)
![AI SDK v7](https://img.shields.io/badge/AI-Vercel%20AI%20SDK%20v7-4A6CF7)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker&logoColor=white)

</div>

> 「知识管理的目标不是记住，而是把原料锻造成作品。」

墨匠是一个跑在你自己机器上的单容器内容工坊：灵感速记汇入统一知识库，AI 编辑部按流水线工位协作，把原料锻造成母稿，再一键转译成适合微信公众号、小红书、知乎等平台的作品。数据全部落在本地 SQLite 文件，大模型走 BYOK（自带密钥），不依赖任何第三方 SaaS。

---

## ✨ 功能特性

### 速记与整理

- **秒级速记** —— 首页主输入框，`Ctrl / ⌘ + Enter` 一键入库，支持 Markdown；AI 自动提炼标题与摘要，`✨ 智能标签` 一键推荐主题标签
- **统一知识库** —— 多知识库卡片画廊 + 三栏工作台（笔记列表 / 编辑器 / 标签面板，左栏可折叠）；笔记支持多选批量移动/删除、悬停 `···` 菜单（导出 / 移动 / 移除 / 删除），自动保存
- **自研 Markdown 编辑器** —— 编辑 / 预览双模式、基础排版工具条；**划词 AI 智鉴**：对选中文本一键执行「拓宽 / 质疑 / 评估 / 精校」四维分析，结果可原位替换或驳回重做
- **知识发芽** —— 以某条笔记为种子，AI 发散多角度观点、抽取「金句回响」视角引文，触发新创作灵感
- **知识金句卡** —— 一键从笔记提炼知识卡片：三类支撑论据（数据 / 亲历案例 / 反例边界）+ 可复用形态（长文段落 / 清单 / 口播 / 金句图）+ 自检结论，`/cards` 卡片画廊统一管理
- **标签主、分类辅** —— 行内增删标签；入库时 AI 自动归类（创作成果 / 认知模型 / 读书剪藏…），记忆与标签视图可见分类徽章
- **多源采集** —— 粘贴文本、网页剪藏（Readability 正文提取）、PDF / Markdown / TXT 文件导入、**浏览器插件剪藏**（设置页生成接口密钥，插件端一键采集入库）

### 创作与分发

- **四道工序、三步工位** —— 构思工位（内含「选题策划 + 素材匹配」两道工序）→ 起草 → 编审分发，可回退重做；AI 编辑部以四工位人格驱动（选题策划 / 素材匹配 / 初稿起草 / 编审审查）
- **AI 编辑部** —— 流水线工位人格名册：预置各工步专属 AI 专家，人格设定、文风提示词、模型温度全部可调，支持自定义工位；起草时自动注入**文风档案**与相关**创作者记忆**
- **知识库问答** —— `⌘J / Ctrl+J` 唤起，可限定全局 / 分类 / 单库范围提问，回答自带知识库引文出处（如：「这篇文章应该从哪个角度切入？」）
- **分发转译** —— 母稿一键转译为微信公众号 / 小红书 / 知乎 / **X Thread** 平台风格，成果页逐平台预览与复制
- **5D 洞察提取** —— 长文入库后自动做平台倾向选题（MediaTopic）与 5D 要素提取，为选题策划提供弹药
- **创作者记忆** —— `/memory` 沉淀思考轨迹：已记录原料 / 总字数 / 知识库统计 + 历史闪念时光流，并自动挖掘洞察（`/api/insights/mine`）
- **文风声库** —— 采样你的历史文字，沉淀可复用的「文风语调档案」（Voice Profiles），让 AI 用你的口吻写作

### 基础体验

- **全局搜索** —— `⌘K / Ctrl+K` 命令面板，一次检索笔记 / 知识库 / 成果；SQLite FTS5 trigram 分词（知识库 + 成果双索引），中文子串检索可用
- **门禁与 BYOK** —— `ACCESS_PASSWORD` 访问口令；多模型通道自由分配（任意 OpenAI 兼容端点，可配多 Provider / 模型通道映射），密钥存本地，设置面板可连通性测试
- **数据导出与备份** —— 笔记 Markdown 导出；SQLite 一致性快照导出（下载后替换 `data/inkcraft.sqlite` 即可整体恢复）
- **明暗双主题** —— 全站单色克制美学，品牌印章 Logo 随主题自动反色

---

## 🏭 工坊流水线

```
速记 · 剪藏 · PDF ──▶ 统一知识库 ──▶ 构思（选题策划 + 素材匹配）──▶ 起草 ──▶ 编审分发 ──▶ 平台转译 · 成果
```

> 构思工位含「选题策划」「素材匹配」两道工序，由 AI 编辑部四工位人格驱动（人格设定 / 文风提示词 / 模型温度全部可配置），任一步可驳回重做。

---

## 🗺️ 页面导览

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 · 速记流 | 主速记输入框 + 标签过滤的笔记流 |
| `/knowledge` | 知识库 | 多库卡片画廊；进入单库为三栏工作台（笔记列表 + Markdown 编辑器 + 标签 / AI 面板） |
| `/workshop` | 内容装配工坊 | 构思（选题+素材）→ 起草 → 编审分发流水线，母稿确认后派生平台作品，支持 `?projectId=` 续写 |
| `/cards` | 知识卡片 | 从笔记提炼的金句卡画廊与检索 |
| `/memory` | 创作者记忆 | 思考轨迹统计 + 历史闪念时光流 |
| `/works` | 成果 | 母稿与平台变体的陈列馆（母稿 / 公众号 / 小红书 / 知乎 / X Thread） |
| `/agents` | 编辑部 | 流水线四工位 AI 人格名册（策划 / 素材 / 起草 / 编审），支持自定义工位 |
| `/tags` | 标签 | 全站标签视图 |
| `/settings` | 设置 | 模型通道分配、文风档案、剪藏插件密钥、数据导出与备份 |
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

首次使用请进入 **设置** 页面填写模型端点与密钥（任何 OpenAI 兼容服务均可，如 DeepSeek）。

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
| 编辑器选中文字 | 划词 AI 智鉴：拓宽 / 质疑 / 评估 / 精校 |

---

## 📁 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页 · 速记流
│   ├── layout.tsx            # 全局布局（侧边导航 + 问答对话框）
│   ├── knowledge/            # 知识库画廊 + [id] 三栏工作台
│   ├── workshop/             # 内容装配工坊（构思 → 起草 → 编审分发）
│   ├── cards/                # 知识金句卡画廊
│   ├── agents/ memory/ works/ tags/ settings/ login/
│   └── api/                  # notes · kbs · search · pipeline · adapt · card
│                            #   · insights · voices · extension · export · …
├── components/
│   ├── editor/               # 自研 Markdown 编辑器（划词 AI 智鉴）
│   ├── workshop/             # 流水线各工位 + 演示数据提示 + 向导
│   ├── ui/                   # shadcn / Radix 基础组件
│   └── sidebar-nav.tsx · global-search-dialog.tsx · ask-command-dialog.tsx · badges.tsx · logo.tsx
└── lib/
    ├── db.ts                 # SQLite · FTS5 trigram ×2 · 触发器
    ├── ai.ts                 # AI SDK 封装 · BYOK · 元数据整理
    ├── pipeline.ts           # 装配流水线（工位状态机）
    ├── search.ts             # 统一检索原语（FTS + LIKE 降级）
    ├── zhijian.ts            # 智鉴四维分析（拓宽 / 质疑 / 评估 / 精校）
    ├── sprout.ts             # 知识发芽（观点发散 + 金句引文）
    ├── cards.ts              # 知识卡片（支撑论据 / 可复用形态 / 自检）
    ├── claims.ts             # 5D 提取 · 论点主张 · 洞察挖掘
    ├── settings.ts · auth.ts # BYOK 模型通道 · 访问门禁
    ├── clip.ts · pdf.ts      # 网页剪藏 · PDF 解析
    └── test/                 # node:test 单元测试
```

---

## 🧪 测试

```bash
pnpm test   # node:test + tsx（chunkText / 检索原语 / 阶段归一化 / settings 迁移）
```

---

## 🎞️ 品牌标识

「点墨成章」：一枚圆角方印（匠 · 雕琢），内嵌负空间墨滴（墨 · 想法），墨滴落下凝成一道墨条（章 · 内容块）——把一滴想法，锻造成一篇文章。纯矢量单色，随明暗主题自动反色。
