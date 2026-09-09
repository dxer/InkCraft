<div align="center">

<img src="public/logo.svg" width="80" alt="墨匠 InkCraft Logo" />

# 墨匠 InkCraft

**本地优先的现代 AI 内容工坊**

统一知识库 ➔ 原子知识提纯 ➔ 智能选题雷达 ➔ 沉浸创作工坊 ➔ 多平台分发派生 · 原生 MCP 协议支持

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Alpine_Linux-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![MCP](https://img.shields.io/badge/MCP-Dual--Mode_HTTP-00C7B7?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5_Trigram-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[快速开始](#-快速开始) • [核心特性](#-核心特性) • [生产部署](#-docker-部署) • [MCP 接入](#-外部-agent-接入-mcp) • [快捷键](#%EF%B8%8F-常用快捷键)

</div>

---

## 💡 为什么选择墨匠？

> 「知识管理的目标不是记住，而是把原料锻造成作品。」

传统的笔记软件容易让人陷入“只存不读、只收不写”的**知识仓鼠症**。墨匠重新设计了从素材输入到内容交付的全生命周期：

- 🔒 **本地优先与数据自持**：所有笔记、卡片、文稿均保存在本地 SQLite 数据库中，支持 WAL 模式与全文检索，不依赖第三方云端数据库；
- 🔑 **自由接入任意模型**：不绑定特定厂商，在设置后台可视化配置任意兼容 OpenAI 接口的模型服务（DeepSeek、OpenAI、SiliconFlow、Ollama 等）；
- 🧠 **认知提纯与主动策划**：告别平庸的单篇长文摘要，自动提纯卢曼式的原子知识卡片，依托智能选题雷达主动碰撞出高传播价值的选题大纲；
- 🔌 **原生 MCP 协议底座**：开放标准双模 MCP（Model Context Protocol）接口，让 Cursor、Claude Desktop、Dify 等外部 Agent 能够直接以你的私有知识库为思考基座。

---

## 🏭 端到端内容生产流水线

```
快速笔记 · 网页剪藏 · PDF / 文本导入
               │
               ▼
       统一本地知识库 (/knowledge)
               │
               ▼
  原子永久卡片提纯 (Claim · Cut · Mechanism · Boundary)
               │
               ▼
    智能选题雷达 (/topics)
  ┌────────────────────────────────────────────────────────┐
  │ 知识簇语义聚合 ➔ 3 选 1 标题矩阵 ➔ 锚定卡片骨架大纲    │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
                  沉浸创作工坊 (/workshop)
                 ┌───────────────────────────┐
                 │ 左栏：原料抽屉与卡片引用   │
                 │ 中间：流式起草与划词智鉴   │
                 │ 顶栏：创作技能与文风挂载   │
                 └─────────────┬─────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
一键派生多平台版本 (微信 / 小红书 / 知乎 / X)     外部 Agent 协同 (/mcp 接口)
            │                                     │
            ▼                                     ▼
      成品库 (/works)                     Claude / Cursor / Dify 知识底座
```

---

## ✨ 核心特性

### 1. 多源素材采集与统一知识库

- **快速笔记**：首页即开即记，支持快捷键 `Ctrl / ⌘ + Enter` 瞬时入库；
- **多源汇聚**：支持富文本粘贴、网页正文智能提取、PDF 文档导入与 Chrome / Edge 浏览器剪藏扩展；
- **自研 Markdown 编辑器**：支持双栏实时预览，内置**划词 AI 智鉴**（对选中文本进行拓宽、质疑、评估、精校四维研判）。

### 2. 原子知识卡片提纯 (`/cards`)

AI 自动将入库笔记精炼萃取为标准的原子永久卡片：

- **断言式标题 (`claim`)**：具备因果逻辑与客观规律的定论；
- **传播切角 (`cut`)**：打破常识的反直觉切入点；
- **底层机制 (`mechanism`)**：深层原理解析与论据支撑；
- **适用边界 (`boundary`)**：失效场景与认知误区；
- **多维度视图**：提供自适应**瀑布看板**、结构化**紧凑清单**以及纯净力导向的**关联拓扑图谱**。

### 3. 智能选题雷达 (`/topics`)

- **知识簇聚合碰撞**：以知识簇为单位通盘研判，自动生成兼具痛点共鸣与深度洞察的 3 选 1 标题矩阵；
- **锚定卡片大纲**：生成的 4 段式大纲段落精确锚定原料卡片，一键直达工坊开始写作；
- **异步后台执行**：采用轻量后台任务机制，支持状态实时轮询，切换页面不中断。

### 4. 沉浸创作工坊与多平台派生 (`/workshop`)

- **双栏原料工作台**：左侧一键检索并展开知识卡片，右侧专注流式创作；
- **文风音色克隆（Voice Profiles）**：录入历史代表作样稿，AI 自动提取行文节奏、句式偏好与语气风格；
- **一键全渠道派生**：主稿完成后，一键派生转译为**微信公众号（带精美内联排版）**、**小红书**、**知乎**、**X (Twitter) Thread** 等多平台专属格式。

### 5. 双模 MCP 开放接口与 API 密钥体系 (`/mcp`)

- **双模通信支持**：
  - **SSE 模式 (`GET /mcp`)**：符合标准 Server-Sent Events 协议，适用于长连接 Agent 交互；
  - **Direct JSON-RPC 模式 (`POST /mcp`)**：支持标准无状态 JSON-RPC 2.0 单次调用；
- **9 大内置 Tools**：
  - **原子卡片层**：`search_cards_by_query`（意图检索引擎）、`get_card_detail`（单卡与批量点查）；
  - **原始文档层**：`list_knowledge_bases`（知识库概览）、`search_documents`（全文检索长篇母档）、`get_document_detail`（长文原文与卡片回溯）；
  - **网状关联层**：`find_related_cards`（概念线索与拓扑关联发现）、`list_tags_and_concepts`（全局认知分布图谱）；
  - **创作与文风层**：`list_topics`（选题灵感与大纲）、`list_recent_works`（历史成稿文风对齐）；
- **安全鉴权机制**：内置基于 SHA-256 的 API Key 管理看板，每次调用自动记录活跃审计。

---

## 🧩 浏览器剪藏扩展插件 (Chrome / Edge)

墨匠配备了专用的浏览器剪藏插件，支持一键将文章、推文和网页选区沉淀入知识库：

1. **直接下载**：在 GitHub 仓库的 **Releases** 或 **Actions Artifacts** 页面直接下载预编译好的 `inkcraft-extension.zip` 并解压；
2. **本地加载**：打开 Chrome / Edge 浏览器，进入 `chrome://extensions/`，开启右上角「开发者模式」，点击「加载已解压的扩展程序」，选择解压后的目录即可；
3. **连接墨匠**：在插件弹窗中填入墨匠服务地址（如 `http://localhost:3000`）并完成连通测试。

> **本地自行构建插件**：在根目录下执行 `pnpm build:extension`，构建产物将输出在 `extension/dist`。

---

## 🚀 快速开始

### 方式 1：使用 Docker Compose（推荐生产部署）

墨匠提供了基于 **Alpine Linux (`node:22-alpine`)** 构建的轻量容器镜像，内置健康检查与数据持久化。默认配置直接拉取 GitHub 官方预编译镜像（`ghcr.io/dxer/inkcraft`），无需本地构建：

```bash
# 1. 克隆代码仓库
git clone https://github.com/dxer/InkCraft.git
cd InkCraft

# 2. 一键启动服务（拉取官方预编译镜像）
docker compose up -d

# 3. 查看运行状态
docker compose ps
```

**本地编译源码**（开发调试或自定义修改后自用）改用编译版配置：

```bash
docker compose -f docker-compose.build.yml up -d --build
```

> 两个 compose 文件均默认挂载同级 `./data` 目录进行持久化，随时互换且数据直观可见。预编译镜像默认追踪 main 分支最新构建，也可在 `docker-compose.yml` 中固定到某次提交。

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始使用。

#### 环境变量说明

在 `docker-compose.yml` 或 `.env.local` 中按需配置：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `TZ` | `Asia/Shanghai` | 容器时区 |
| `ACCESS_PASSWORD` | *(留空)* | 站点访问口令。留空则首次访问时在登录页引导设置访问口令（落库持久化）；忘记口令时设置此项即可覆盖登入 |
| `TRUST_PROXY` | *(未设置)* | 反向代理（nginx/Caddy 等）部署时设为 `true`：登录限流采信真实客户端 IP、Cookie Secure 标记采信 X-Forwarded-Proto；直连部署保持默认（代理头可被伪造） |
| `INKCRAFT_DB_PATH` | `/app/data/inkcraft.sqlite` | SQLite 数据文件持久化路径 |

> **💡 模型配置**：启动后，登录后台前往 **「系统设置」(`/settings`)** 页面，即可可视化添加任意 OpenAI 兼容服务（如 DeepSeek、OpenAI、Ollama 等）并分配通道。

---

### 方式 2：本地源码运行开发

**环境要求**：Node.js >= 20.x, pnpm >= 9.x

```bash
# 安装依赖
pnpm install

# 启动本地开发服务
pnpm dev

# 生产编译与运行
pnpm build
pnpm start
```

---

## 🤖 外部 Agent 接入 (MCP)

在墨匠后台 **「系统设置 ➔ MCP 与 API 密钥」** 中创建并获取你的专属 API Key (`ink_live_...`)：

### Claude Desktop 配置

编辑 `claude_desktop_config.json`：

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

### Cursor 配置

在项目根目录 `.cursor/mcp.json` 中添加：

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

## 🗺️ 页面导览

| 路径 | 模块 | 核心功能 |
| --- | --- | --- |
| `/` | 快速笔记 (The Stream) | 快速记录灵感、多标签过滤与素材溯源 |
| `/knowledge` | 知识库 (The Archives) | 专题知识库管理与多栏 Markdown 编辑工作台 |
| `/cards` | 知识卡片 (The Cards) | 原子永久卡片看板、紧凑清单与关联拓扑图谱 |
| `/topics` | 选题雷达 (The Radar) | 知识簇碰撞策划、3 选 1 标题矩阵与大纲开写 |
| `/workshop` | 创作工坊 (The Workshop) | 双栏原料工作台、文风音色挂载与多平台一键派生 |
| `/works` | 成品库 (The Showcase) | 正式成稿母篇与跨平台变体沉淀收录 |
| `/agents` | 创作技能 (The Skills) | 创作技能与专家人格准则配置 |
| `/settings` | 系统设置 (The Config) | 模型通道配置、文风档案克隆、MCP 密钥与剪藏插件 |

---

## 🧩 浏览器剪藏扩展 (Chrome / Edge)

墨匠内置了基于 Manifest V3 的官方浏览器扩展（位于 `extension/` 目录）：

1. **编译扩展**：在 `extension` 目录下执行 `pnpm build`（生成 `extension/dist` 产物）；
2. **加载扩展**：打开 Chrome / Edge 的扩展管理页（`chrome://extensions/`），开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `extension/dist` 目录；
3. **配置连接**：点击扩展图标，填写墨匠服务地址（如 `http://localhost:3000`）和 API Key（在 Web 端「系统设置 ➔ 浏览器剪藏扩展」中生成）；
4. **一键剪藏**：浏览网页时支持**全页文章采集**、**划词选中采集**以及**页内区域框选剪藏**，并可指定保存的目标知识库。

---

## ⌨️ 常用快捷键

| 快捷键 | 功能 |
| --- | --- |
| `⌘ / Ctrl + K` | 全局快速搜索（笔记 / 知识库 / 作品） |
| `⌘ / Ctrl + J` | 知识库 AI 智能问答（精准定位引用源） |
| `⌘ / Ctrl + Enter` | 首页快速笔记瞬时入库 |
| `⌘ / Ctrl + S` | 保存当前正在编辑的笔记 |
| 编辑器选中文字 | 呼出划词 AI 智鉴（拓宽 / 质疑 / 评估 / 精校） |

---

## 🛠️ 技术栈

- **Core Framework**: Next.js 16 (App Router · Turbopack) + React 19
- **Protocol**: Model Context Protocol (MCP) · SSE + Direct JSON-RPC
- **AI SDK**: Vercel AI SDK v7 (`@ai-sdk/openai-compatible`)
- **Storage & Search**: SQLite 3 (better-sqlite3) + WAL Mode + FTS5 Trigram Tokenizer
- **Styling & UI**: Tailwind CSS v4 + Radix UI + shadcn/ui + Lucide Icons
- **Content Parser**: marked + @mozilla/readability + jsdom + pdf-parse

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 授权开源。
