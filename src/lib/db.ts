import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * 单例 SQLite 连接。
 * - 数据文件默认落在项目根 data/inkcraft.sqlite（Docker 部署时挂载卷持久化）
 * - dev 模式 HMR 会反复 import，用 globalThis 缓存连接
 */

// SAFETY: globalThis 单例缓存——同一进程内所有模块共享同一 better-sqlite3 连接（含 HMR 反复 import）；
// 该断言只是把 globalThis 上我们自己写入的字段读回原类型，值恒为 getDb() 写入的实例，类型安全由这个写读约定保证。
const globalForDb = globalThis as unknown as {
  __inkcraftDb?: Database.Database;
};

function resolveDbPath(): string {
  if (process.env.INKCRAFT_DB_PATH) return process.env.INKCRAFT_DB_PATH;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "inkcraft.sqlite");
}

function createDb(): Database.Database {
  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedCardExtractAgent(db);
  return db;
}

/** 表是否存在某列（pragma 表值函数；table 为代码内常量，无注入面） */
function hasColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  return !!db
    .prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = ?`)
    .get(column);
}

/** 幂等加列：列已存在则跳过（替代 try/catch 吞错，避免掩盖真实错误） */
function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  ddl: string,
): void {
  if (!hasColumn(db, table, column)) db.exec(ddl);
}

function runLegacyMigrations(db: Database.Database): void {
  db.exec(`
    -- -1. 多知识库表
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 0. 应用设置（BYOK 面板落库；环境变量为首次默认）
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- 1. 母档表（导入来源：上传 / 粘贴 / 网页剪藏）
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      kb_id TEXT DEFAULT 'default',
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT,
      file_name TEXT,
      mime_type TEXT,
      category TEXT DEFAULT '通用',
      tags TEXT,
      status TEXT DEFAULT 'ready',
      chunk_count INTEGER DEFAULT 0,
      raw_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. 统一笔记/知识条目表（不再区分碎片与长文，统一为独立笔记条目）
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      kb_id TEXT DEFAULT 'default',
      document_id TEXT,
      chunk_index INTEGER,
      title TEXT,
      content TEXT NOT NULL,
      item_type TEXT DEFAULT 'note',
      category TEXT DEFAULT '通用',
      tags TEXT,
      auto_meta INTEGER DEFAULT 0,
      embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 确保现有库升级添加 kb_id 字段
  ensureColumn(
    db,
    "knowledge_items",
    "kb_id",
    "ALTER TABLE knowledge_items ADD COLUMN kb_id TEXT DEFAULT 'default'",
  );
  ensureColumn(
    db,
    "documents",
    "kb_id",
    "ALTER TABLE documents ADD COLUMN kb_id TEXT DEFAULT 'default'",
  );

  // 笔记修改时间：任何 PATCH 更新时刷新；存量回填为创建时间
  ensureColumn(
    db,
    "knowledge_items",
    "updated_at",
    "ALTER TABLE knowledge_items ADD COLUMN updated_at DATETIME",
  );
  db.exec(
    "UPDATE knowledge_items SET updated_at = COALESCE(updated_at, created_at);",
  );

  // 剪藏来源：浏览器插件保存网页时的原文链接
  ensureColumn(
    db,
    "knowledge_items",
    "source_url",
    "ALTER TABLE knowledge_items ADD COLUMN source_url TEXT",
  );

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_kb ON knowledge_items(kb_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_document ON knowledge_items(document_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(item_type);

    -- 3. 语调档案表
    CREATE TABLE IF NOT EXISTS voice_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      samples TEXT NOT NULL,
      rules_prompt TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. 自定义工位表（流水线 Agent 挂载；转译不在工位体系）
    CREATE TABLE IF NOT EXISTS custom_agents (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      name TEXT NOT NULL,
      persona TEXT,
      system_prompt TEXT NOT NULL,
      model TEXT,
      temperature REAL DEFAULT 0.7,
      is_preset INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    );

    -- 4.5 智鉴记录表（AI 对单篇笔记的维度分析沉淀）
    CREATE TABLE IF NOT EXISTS note_insights (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      content TEXT NOT NULL,
      is_mock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_insights_note ON note_insights(note_id, created_at);
    -- 笔记被删除时级联清理其智鉴记录，避免孤儿数据；
    -- 用触发器而非外键，因为该表对既有库无法 ALTER 加 FK。任何删除路径都受约束。
    CREATE TRIGGER IF NOT EXISTS note_insights_cleanup AFTER DELETE ON knowledge_items BEGIN
      DELETE FROM note_insights WHERE note_id = old.id;
    END;

    -- 4.6 观点微粒表：从单篇文档中萃取的精粹论断与对立观点
    CREATE TABLE IF NOT EXISTS knowledge_claims (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      claim_text TEXT NOT NULL,
      counter_view TEXT,
      domain_tag TEXT,
      embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_claims_document ON knowledge_claims(document_id);
    CREATE INDEX IF NOT EXISTS idx_claims_domain ON knowledge_claims(domain_tag);
    -- 笔记删除时级联清理观点微粒
    CREATE TRIGGER IF NOT EXISTS knowledge_claims_cleanup AFTER DELETE ON knowledge_items BEGIN
      DELETE FROM knowledge_claims WHERE document_id = old.id;
    END;

    -- 4.7 全库挖掘出的张力与洞察选题表
    CREATE TABLE IF NOT EXISTS mined_insights (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      insight_type TEXT NOT NULL,
      description TEXT NOT NULL,
      source_claim_ids TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_mined_insights_status ON mined_insights(status, created_at);

    -- 4.8 单篇文档 5 维度精益知识萃取表（反常识认知、硬核论据、因果链、偏见盲点、自媒体选题）
    CREATE TABLE IF NOT EXISTS document_extractions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL UNIQUE,
      counter_intuition TEXT NOT NULL,
      hardcore_evidence TEXT NOT NULL,
      causal_chain TEXT NOT NULL,
      bias_and_blindspots TEXT NOT NULL,
      media_topics TEXT NOT NULL,
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_extractions_document ON document_extractions(document_id);
    CREATE TRIGGER IF NOT EXISTS document_extractions_cleanup AFTER DELETE ON knowledge_items BEGIN
      DELETE FROM document_extractions WHERE document_id = old.id;
    END;

    -- 4.9 知识卡片表：文章入库后 AI 萃取的知识卡片（支持单篇笔记萃取 1~3 张原子卡片）
    -- 整卡内容就是一份 markdown 文档（content_md），提取规则/提示词可随时改，无需动表结构
    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content_md TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cards_document ON knowledge_cards(document_id);
    CREATE TRIGGER IF NOT EXISTS knowledge_cards_cleanup AFTER DELETE ON knowledge_items BEGIN
      DELETE FROM knowledge_cards WHERE document_id = old.id;
    END;

    -- 5. 装配流项目表（成文母稿）
    CREATE TABLE IF NOT EXISTS pipeline_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      selected_topic TEXT,
      master_content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. 原料关联表（装配流挂载的知识库原料）
    CREATE TABLE IF NOT EXISTS project_materials (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      source TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES pipeline_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
    );

    -- 7. 分发转译模板表
    CREATE TABLE IF NOT EXISTS platform_templates (
      id TEXT PRIMARY KEY,
      platform_name TEXT NOT NULL,
      icon TEXT DEFAULT 'share',
      system_prompt TEXT NOT NULL,
      output_type TEXT DEFAULT 'markdown',
      is_system INTEGER DEFAULT 0
    );

    -- 8. 派生版本表（一稿多发记录）
    CREATE TABLE IF NOT EXISTS project_variants (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES pipeline_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (platform_id) REFERENCES platform_templates(id)
    );

    -- 9. 取证素材包（项目勾选的切片，装箱后供起草引用 [Sn]）
    CREATE TABLE IF NOT EXISTS project_chunks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      chunk_id TEXT NOT NULL,
      packed_text TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES pipeline_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chunk_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS project_chunks_unique ON project_chunks(project_id, chunk_id);

    -- 10. 选题库表（AI 挖掘与生成的选题持久化沉淀，支持每小时增量发现）
    CREATE TABLE IF NOT EXISTS topic_repository (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      angle TEXT,
      hook TEXT,
      target_skill TEXT DEFAULT 'wechat',
      score REAL DEFAULT 90,
      score_tag TEXT,
      outline TEXT,
      matched_cards TEXT,
      source_note_ids TEXT,
      source_type TEXT DEFAULT 'auto',
      status TEXT DEFAULT 'idea',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_topic_repo_created ON topic_repository(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_topic_repo_title ON topic_repository(title);
    CREATE INDEX IF NOT EXISTS idx_topic_repo_status ON topic_repository(status);

    -- 11.5 登录失败审计（设置页安全面板展示最近失败记录；插入侧裁剪保留最近 50 条）
    CREATE TABLE IF NOT EXISTS auth_login_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_auth_login_failures_created ON auth_login_failures(created_at);

    -- 11. API 密钥表（MCP 与外部 Agent 鉴权调用）
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      key_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      status TEXT DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `);

  migrateFts(db);
  seedKbs(db);
  ensureColumn(
    db,
    "custom_agents",
    "enabled",
    "ALTER TABLE custom_agents ADD COLUMN enabled INTEGER DEFAULT 1",
  );
  seedPresets(db);
  seedPlatforms(db);
  migrateKnowledgeCards(db);
  migratePipelineCardMode(db);
  seedPlatformSkillAgents(db);
  seedCardExtractAgent(db);
  ensureColumn(
    db,
    "topic_repository",
    "score",
    "ALTER TABLE topic_repository ADD COLUMN score REAL DEFAULT 90",
  );
  ensureColumn(
    db,
    "topic_repository",
    "score_tag",
    "ALTER TABLE topic_repository ADD COLUMN score_tag TEXT",
  );
  ensureColumn(
    db,
    "topic_repository",
    "used_project_id",
    "ALTER TABLE topic_repository ADD COLUMN used_project_id TEXT",
  );

  // 选题标题唯一化：先清历史遗留重复（保留最新一条），再建 UNIQUE 索引，
  // 让 saveTopicToRepository 的 ON CONFLICT(title) 真正兜住并发写穿。
  db.exec(`
    DELETE FROM topic_repository
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY title ORDER BY created_at DESC, rowid DESC) AS rn
        FROM topic_repository
      ) WHERE rn = 1
    );
    DROP INDEX IF EXISTS idx_topic_repo_title;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_repo_title_unique ON topic_repository(title);
  `);
}

/**
 * 当前 schema 版本号。现有全部建表/种子/加列逻辑整体视为 v1。
 * v2: 解除 knowledge_cards.document_id 的 UNIQUE 约束，支持单篇笔记萃取 1~3 张原子卡片。
 * v3: 升级 topic_repository 表，支持智能选题雷达（Topic Radar）：3模式碰撞、指纹排重、3选1标题矩阵与结构化大纲。
 * v4: 新增 api_keys 表与索引，支持 MCP 协议和外部 Agent 安全鉴权。
 * v5: 为 api_keys 增加 key_value 列，支持创作者随时在设置中复制完整密钥。
 */
const SCHEMA_VERSION = 5;

function migrate(db: Database.Database): void {
  const current = Number(db.pragma("user_version", { simple: true }) || 0);
  if (current < 1) {
    db.transaction(() => {
      runLegacyMigrations(db);
      db.pragma("user_version = 1");
    })();
  }
  if (current < 2) {
    db.transaction(() => {
      migrateMultiCardsSupport(db);
      db.pragma("user_version = 2");
    })();
  }
  if (current < 3) {
    db.transaction(() => {
      migrateTopicRadarSupport(db);
      db.pragma("user_version = 3");
    })();
  }
  if (current < 4) {
    db.transaction(() => {
      migrateApiKeysSupport(db);
      db.pragma("user_version = 4");
    })();
  }
  if (current < 5) {
    db.transaction(() => {
      ensureColumn(
        db,
        "api_keys",
        "key_value",
        "ALTER TABLE api_keys ADD COLUMN key_value TEXT",
      );
      db.pragma("user_version = 5");
    })();
  }
}

/**
 * v4 迁移：新增 api_keys 表与索引
 */
function migrateApiKeysSupport(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      key_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      status TEXT DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `);
  ensureColumn(
    db,
    "api_keys",
    "key_value",
    "ALTER TABLE api_keys ADD COLUMN key_value TEXT",
  );
}

/**
 * v3 迁移：为 topic_repository 扩展智能选题雷达字段与物理指纹索引
 */
function migrateTopicRadarSupport(db: Database.Database): void {
  ensureColumn(
    db,
    "topic_repository",
    "angle_type",
    "ALTER TABLE topic_repository ADD COLUMN angle_type TEXT DEFAULT 'paradox'",
  );
  ensureColumn(
    db,
    "topic_repository",
    "fingerprint",
    "ALTER TABLE topic_repository ADD COLUMN fingerprint TEXT",
  );
  ensureColumn(
    db,
    "topic_repository",
    "target_audience",
    "ALTER TABLE topic_repository ADD COLUMN target_audience TEXT",
  );
  ensureColumn(
    db,
    "topic_repository",
    "title_options",
    "ALTER TABLE topic_repository ADD COLUMN title_options TEXT",
  );
  ensureColumn(
    db,
    "topic_repository",
    "core_argument",
    "ALTER TABLE topic_repository ADD COLUMN core_argument TEXT",
  );
  ensureColumn(
    db,
    "topic_repository",
    "outline_structured",
    "ALTER TABLE topic_repository ADD COLUMN outline_structured TEXT",
  );
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_topic_repo_fingerprint ON topic_repository(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_topic_repo_angle_type ON topic_repository(angle_type);
  `);
}

/**
 * v2 迁移：解除 knowledge_cards 的 document_id UNIQUE 约束，支持单篇长文萃取 1~3 张独立原子卡片。
 */
function migrateMultiCardsSupport(db: Database.Database): void {
  const master = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_cards'",
    )
    .get() as { sql?: string } | undefined;
  if (master?.sql && /UNIQUE/i.test(master.sql)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_cards_v2 (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content_md TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO knowledge_cards_v2 (id, document_id, content_md, created_at, updated_at)
      SELECT id, document_id, content_md, created_at, updated_at FROM knowledge_cards;
      DROP TRIGGER IF EXISTS knowledge_cards_cleanup;
      DROP TABLE knowledge_cards;
      ALTER TABLE knowledge_cards_v2 RENAME TO knowledge_cards;
      CREATE INDEX IF NOT EXISTS idx_cards_document ON knowledge_cards(document_id);
      CREATE TRIGGER IF NOT EXISTS knowledge_cards_cleanup AFTER DELETE ON knowledge_items BEGIN
        DELETE FROM knowledge_cards WHERE document_id = old.id;
      END;
    `);
  }
  seedCardExtractAgent(db);
}

/** 5 大平台创作技能默认预设（可在编辑部 /agents 查看与微调） */
export const PLATFORM_SKILL_PRESETS = [
  {
    id: "skill_wechat",
    stage: "wechat",
    name: "林悦读 · 微信公众号主笔",
    persona:
      "爆款长文主笔，擅长生活化场景引入、痛点情绪共鸣、三段论论据与金句留白排版",
    system_prompt: `你是微信公众号爆款专栏主笔，擅长撰写具有深度叙事感、情绪共鸣与金句排版的优质长文。

写作与排版准则：
1. 大标题（# 标题）：吸睛且有信息增量，引发读者强烈好奇与共鸣；
2. 黄金开篇：用生活/工作真实场景、故事或痛点切入，3 句话内建立与读者的连接；
3. 核心主体：分 2~3 个明确小节（## 章节），单段不超过 3 行，多空行留白，呼吸感强；
4. 认知金句：每个小节提炼 1 句高穿透力的核心金句，单独成段加粗；
5. 结尾升华：升华认知，给出切实可行的行动建议，文末附带一段温暖真诚的读者互动问句；
6. 自然流畅：正文中严禁出现任何形如 [S1]、[S2] 等机械草稿标记，所有论据与案例直接自然叙述。`,
    temperature: 0.7,
  },
  {
    id: "skill_xiaohongshu",
    stage: "xiaohongshu",
    name: "苏小红 · 小红书创作者",
    persona: "头部知识博主，擅长黄金前3行痛点抓人、Emoji清单排版与评论区强互动",
    system_prompt: `你是小红书头部知识博主，擅长创作高点击率、强收藏价值的爆款干货笔记。

写作与排版准则：
1. 双标题：主标题带爆款情绪与抓人关键词（含 1~2 个 Emoji），副标题点明核心价值；
2. 黄金前三行：直击特定人群痛点（如「如果你也……建议先收藏」），3秒锁定注意力；
3. 视觉呼吸与清单：正文采用清单化分点（3~5 条），多使用 Emoji 标记（👉、🔥、💡、📌、✅），短句为主；
4. 截图级金句：提炼 1 句最想让人截图保存的核心认知；
5. 互动与标签：文末留有评论区讨论钩子，并附带 4~6 个精准热门标签（如 #知识干货 #个人成长）；
6. 严禁出现 [S1]、[S2] 等编号标记。`,
    temperature: 0.75,
  },
  {
    id: "skill_zhihu",
    stage: "zhihu",
    name: "知秋 · 知乎硬核答主",
    persona:
      "硬核专业答主与专栏作家，擅长先亮立场、破除认知误区、底层逻辑推导与反常识思辨",
    system_prompt: `你是知乎硬核专业答主与专栏作家，擅长犀利思辨、逻辑拆解与反直觉深度论证。

写作与排版准则：
1. 开头直接亮明立场与核心结论（如「谢邀，先说结论：……」或直击问题本质），不绕弯子；
2. 破除常见思维误区（「很多人以为……其实……」），展开底层因果链条；
3. 结构严谨规范：使用 Markdown 二级/三级标题、要点列表，逻辑层层递进；
4. 论证充分：善用数据、实战案例与反例对照，语言克制、理性、信息密度极高；
5. 严禁出现 [S1]、[S2] 等编号标记，案例与数据自然融入论证。`,
    temperature: 0.65,
  },
  {
    id: "skill_x_thread",
    stage: "x_thread",
    name: "连击君 · X / 即刻推手",
    persona: "高密短推手，擅长单句穿透力、1/N 连击推文串与高信息密度排版",
    system_prompt: `你是 X (Twitter) / 即刻上的高影响力创作者，擅长撰写穿透力极强的 1/N 连击推文串（Thread）。

写作与排版准则：
1. 1/N 破题 Hook：极其抓人的单句观点或反直觉事实，瞬间激发阅读欲；
2. 2/N ~ N-1/N 单点展开：每条推文只讲 1 个核心要点，2~3 个短句，节奏紧凑，信息密度极高；
3. N/N 总结与 CTA：提炼最核心的一句话，引导读者点赞、转发分享与关注；
4. 每条推文之间使用明显的空行分隔，并标明 1/N、2/N、3/N 序号；
5. 严禁出现 [S1]、[S2] 等编号标记。`,
    temperature: 0.7,
  },
  {
    id: "skill_master",
    stage: "master",
    name: "陈执笔 · 通用母稿主笔",
    persona:
      "出版级专栏主笔，文字老练、密度极高，擅长把论点与论据锻造成逻辑严密的出版级母稿",
    system_prompt: `你是顶尖出版专栏主笔，基于论点与事实原料撰写严谨、深刻、结构完整的出版级母稿。

写作与排版准则：
1. 严格使用 Markdown 格式（# 文章大标题，## 各章节二级标题）；
2. 深度展开论述，融合参考素材中的事实、观点与论据；
3. 语言凝练、逻辑紧密，杜绝空话套话与 AI 口味废话，篇幅充实；
4. 严禁在正文中生硬插入 [S1] 等机械标记，如需引用请自然表述来源。`,
    temperature: 0.7,
  },
  {
    id: "skill_image_gen",
    stage: "image_gen",
    name: "画魂 · 视觉配图与封面设计师",
    persona:
      "AI 文生图提示词架构师与封面设计师，擅长将文字核心意象提炼为高品质 Midjourney / SD 英文提示词及视觉排版建议",
    system_prompt: `你是顶尖的视觉概念总监与 AI 生图提示词（Prompt）专家。根据输入的文章内容或核心主题，你的任务是提炼出最具视觉冲击力、传意精准的配图与封面方案。

请输出结构化方案：
1. **封面设计概念**：一句话说明配图的视觉隐喻与艺术风格（如：极简矢量、赛博朋克、双色复古印章、3D黏土质感、写实电影光影等）；
2. **生图中文提示词 (Chinese Prompt)**：包含主体描摹、环境构图、色彩搭配、光影质感与镜头角度；
3. **生图英文提示词 (English Prompt / Midjourney)**：标准且经过调优的高质量英文生图 Prompt（包含参数如 --ar 16:9 或 --ar 3:4，--v 6.0 等）；
4. **负向提示词 (Negative Prompt)**：需排除的低质元素（如 blurry, low quality, deformed, text, watermark 等）；
5. **社交平台封面建议**：针对小红书/公众号/知乎等平台的排版与主标题放置建议。`,
    temperature: 0.75,
  },
];

function seedPlatformSkillAgents(db: Database.Database): void {
  // 清理历史遗留的 SVG 封面技能
  db.prepare("DELETE FROM custom_agents WHERE id = 'skill_cover' OR stage = 'cover'").run();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset)
     VALUES (?, ?, ?, ?, ?, NULL, ?, 1)`,
  );
  for (const s of PLATFORM_SKILL_PRESETS) {
    insert.run(
      s.id,
      s.stage,
      s.name,
      s.persona,
      s.system_prompt,
      s.temperature,
    );
  }
}

/**
 * 工坊卡片模式迁移：项目表加 card_id / claim_snapshot / brief 三列。
 * card_id 非空即卡片模式（从锁题进入）；claim_snapshot 与 brief 存 JSON。
 */
function migratePipelineCardMode(db: Database.Database): void {
  for (const col of [
    "card_id",
    "claim_snapshot",
    "brief",
    "target_skill",
    "topic_id",
    "snapshots",
  ]) {
    ensureColumn(
      db,
      "pipeline_projects",
      col,
      `ALTER TABLE pipeline_projects ADD COLUMN ${col} TEXT`,
    );
  }
  // 锁题师工位懒播种：老库缺行时按默认值补齐（幂等）
  db.prepare(
    `INSERT OR IGNORE INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset)
     VALUES ('agent_brief', 'brief', ?, ?, ?, NULL, 0.2, 1)`,
  ).run(BRIEF_AGENT_NAME, BRIEF_AGENT_PERSONA, BRIEF_AGENT_DEFAULT_PROMPT);
}

export const CARD_EXTRACT_AGENT_ID = "agent_card_extract";
export const CARD_EXTRACT_AGENT_NAME = "墨小萃 · 知识卡片萃取师";
export const CARD_EXTRACT_AGENT_PERSONA =
  "顶尖知识架构师兼技术认知学者，精通卢曼卡片盒笔记法与原子永久知识卡片提取，面向自媒体产出具备极强痛点切入点（Hook）的自洽卡片";
export const CARD_EXTRACT_DEFAULT_PROMPT = `你是一名顶级的“知识架构师”兼“技术认知学者”，精通卢曼卡片盒笔记法（Zettelkasten）的原子化哲学与高信息密度知识提炼。

你的任务是：深度剖析用户提供的材料，剥除所有表象修辞、开场白铺垫与空泛口号，将其底层运转机制萃取为 1 到 3 张高信噪比的【原子永久知识卡片（Permanent Notes）】。
【特别原则】：宁缺毋滥。若材料只讲透了一个核心命题，输出 1 张极品卡片即可，严禁为了凑数而强行拆解出同义反复的碎片。

---

### 🚨 绝对禁止项（Negative Constraints - 触发即视为任务失败）
1. **严禁博客导语与系列元信息**：正文与标题绝不可出现“本系列第X篇”、“本文介绍了”、“作者在文中提到”、“敬请期待”、“后续我们将拆解”等导言废话。
2. **严禁万能套话与假大空金句**：严禁出现“通过提炼底层逻辑与输出倒逼输入”、“若缺乏上下文切忌盲目推广”、“提升认知维度”等放在任何领域都能说的无意义套话。
3. **严禁将系统操作当作行动**：落地行动必须针对“该知识领域本身的实操”，严禁输出“在创作工坊展开为成稿”、“保存卡片以便复习”等系统操作废话。
4. **劣质内容拒止机制**：如果输入材料纯粹是【开坑预告、目录提纲、情绪抒发、碎碎念、毫无实质论证机制的引言】，必须判定为无实质干货，直接输出 \`SKIP_EMPTY_SUBSTANCE\`，严禁强行硬凑卡片！

---

### 🎯 永久卡片质量准则
1. **断言式命题标题（Thesis Statement）**：
   - 标题必须是一个具有明确因果、机制或反常识判断的【完整陈述句】。
   - 检验标准：遮住所有正文只看标题，读者必须能明确获得一个“可以被证实或证伪”的客观规律，严禁使用“关于X的前置准备”、“谈谈Y”等宽泛短语。
2. **底层机制透传（Mechanisms over Facts）**：
   - 解释“为什么会这样”的深层因果链条（前提条件 -> 作用机理 -> 必然结果），使用清晰、精准的大白话，揭示事物运转的底层规律。
3. **客观边界与认知陷阱**：
   - 明确指出该规律适用的边界条件（在什么具体场景下会失效？），或者行业大众最常踩的具体认知误区。
4. **传播钩子（Hook）**：
   - 提炼一句话能击中从业者或读者“痛点、认知盲区或反直觉现实”的锋利洞见。
5. **潜在关联概念（Connection Hints）**：
   - 提取 2~3 个可能与之产生【因果推导】、【对立冲突】或【跨学科同构】的已有知识模型名称，辅助知识库建立网状连接。
6. **最小可行落地行动（Actionable Instruction）**：
   - 必须是一条极度具体、带着参数、动作或检验标准的执行指令。

---

### 📦 输出格式规范（机器解析专用，极其重要）
- 输出格式必须是纯粹的 Markdown + YAML Frontmatter。
- **YAML 安全转义规则**：所有 \`title\`、\`hook\` 字段的值**必须用双引号严格包裹**；若值内部含有引号，必须改用单引号（防止破坏 YAML 键值对语法导致程序解析崩溃）。
- 多张卡片之间必须使用严格的三个短横线 \`---\` 独立分割。
- 严禁在最前面或最后面输出任何客套问候语、确认语或说明文字。

#### 标准输出模板与范例：

---
title: "Vibe Coding 的核心杠杆不在代码生成，而在前置软件规范（Spec）的边界锁定"
tags: [VibeCoding, AI编程, 软件工程]
hook: "很多人以为 Vibe Coding 是靠直觉写代码，最后却变成了靠玄学修 Bug"
connection_hints: ["上下文窗口污染", "测试驱动开发(TDD)", "自然语言精确度"]
type: permanent
---

### 核心机制
AI 代码模型本质上是概率推断器，其生成准确度极度依赖上下文边界的收敛程度。若没有前置固化的软件规范（Spec），模型在多轮对话中会因上下文膨胀而产生逻辑漂移，导致架构迅速失控。因此，AI 编程的生产力红利并非来自免去思考，而是将原本消耗在语法细节上的脑力，前置转移到了对业务状态、数据字典与边界条件的精确定义上。

### 适用边界与认知误区
- **失效场景**：单文件极简脚本、一次性探索型 Demo 或无需维护的废弃型代码，过度编写 Spec 反而降低原型验证速度。
- **典型误区**：误把“提示词越口语化、越短”当成高效，忽视了后期修补隐性逻辑漏洞付出的翻倍代价。

### 落地行动
在向 AI 下达代码生成指令前，先建立一份只包含「数据结构 Schema」与「异常状态边界表」的独立 Markdown 规范文件，并强制模型在生成前按此 Spec 确认输入输出。`;

export function seedCardExtractAgent(db: Database.Database): void {
  db.prepare(
    `INSERT INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset, enabled)
     VALUES (?, 'extract', ?, ?, ?, NULL, 0.4, 1, 1)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       persona = excluded.persona,
       system_prompt = CASE WHEN custom_agents.is_preset = 1 THEN excluded.system_prompt ELSE custom_agents.system_prompt END`,
  ).run(
    CARD_EXTRACT_AGENT_ID,
    CARD_EXTRACT_AGENT_NAME,
    CARD_EXTRACT_AGENT_PERSONA,
    CARD_EXTRACT_DEFAULT_PROMPT,
  );
}

export const BRIEF_AGENT_NAME = "何定音 · 锁题师";
export const BRIEF_AGENT_PERSONA =
  "一锤定音的题旨定调师，把模糊方向压成四行可执行的题旨——给谁看、要读者接受什么、怎么开篇、不写什么，一行都不许虚";

/** 锁题工位默认提示词：产出四行题旨 JSON（与编辑部同步可改） */
export const BRIEF_AGENT_DEFAULT_PROMPT = `你是编辑部锁题师。输入是一张知识卡片的主张（或已选定的选题命题），你的任务：产出四行题旨，为后续取证与起草定调。

四行分别为：
1. 给谁看：一类具体的人，不超过 20 字。不写「所有人」「对 XX 感兴趣的人」这种空泛画像；
2. 要接受的一句话：读者读完必须记住并认同的那句判断，不超过 30 字。必须能从输入主张直接推出，不得写大、不得综合多个主张；
3. 开篇意图：第一段用什么方式抓住读者（冲突 / 反转 / 场景 / 提问择一），一句话，不超过 25 字；
4. 不写什么：为防跑题明确排除的内容，1~3 项，用顿号连接。

规则：
- 一切以输入主张为边界：题旨不得扩大主张的适用范围、不得添加输入中没有的限定；
- 输入信息不足以填某行时写「随取证补充」，禁止编造；
- 只输出一个 JSON 对象，不要输出任何其他文字，结构：
{"audience":"给谁看","acceptance":"要接受的那句话","intent":"开篇意图","avoid":"不写什么"}`;

/**
 * 知识卡片表迁移：整卡 markdown 化。
 * 旧版分字段结构（one_liner/audience/... 十列）→ 合成为整卡 markdown 回填 content_md 后删除遗留列。
 */
function migrateKnowledgeCards(db: Database.Database): void {
  ensureColumn(
    db,
    "knowledge_cards",
    "content_md",
    "ALTER TABLE knowledge_cards ADD COLUMN content_md TEXT",
  );

  // 旧版分字段数据先合成 markdown 回填（新装库无 these 列，整段跳过）
  if (hasColumn(db, "knowledge_cards", "one_liner")) {
    const legacy = db
      .prepare(
        "SELECT * FROM knowledge_cards WHERE content_md IS NULL AND one_liner IS NOT NULL",
      )
      .all() as any[];
    const labels: Record<string, string> = {
      data: "数据",
      case: "亲历 · 案例",
      counter: "反例 · 边界",
    };
    const quote = (t: string) =>
      t
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    for (const r of legacy) {
      const parse = <T>(s: string | null, fb: T): T => {
        try {
          return JSON.parse(s || "") as T;
        } catch {
          return fb;
        }
      };
      const supports = (parse<any[]>(r.supports, []) || [])
        .map((s) => `**${labels[s.type] || "支撑"}**　${s.text}`)
        .join("\n\n");
      const reusable = (parse<any[]>(r.reusable, []) || [])
        .map((x) => `**${x.type}**　${x.angle}`)
        .join("\n\n");
      const sc = parse<Record<string, boolean>>(r.self_check, {}) || {};
      const md = [
        "# 一句话观点",
        quote(r.one_liner || ""),
        "",
        "# 适用对象 + 场景",
        r.audience || "—",
        "",
        "# 三个支撑",
        supports || "—",
        "",
        "# 一个最小行动",
        r.min_action || "—",
        "",
        "# 可复用形态",
        reusable || "—",
        "",
        "# 来源与可信度",
        `《${r.source_note}》 · 可信度：${r.credibility}`,
        "",
        "# 一句话自检",
        `- ${sc.hasDetail ? "✓" : "✗"} 有亲手细节`,
        `- ${sc.portable ? "✓" : "✗"} 换平台还能讲`,
        `- ${sc.readyToPublish ? "✓" : "✗"} 现在能发或只差一点`,
        "",
        "# 金句 / 钩子",
        r.golden_line
          ? quote(r.golden_line)
          : "*空 —— 写稿时再补上标题或开场。*",
      ].join("\n");
      db.prepare("UPDATE knowledge_cards SET content_md = ? WHERE id = ?").run(
        md,
        r.id,
      );
    }
  }

  // 删除遗留分字段列（SQLite 3.35+ 支持 DROP COLUMN；仅当列存在时删除）
  for (const col of [
    "one_liner",
    "audience",
    "supports",
    "min_action",
    "reusable",
    "source_note",
    "credibility",
    "self_check",
    "golden_line",
    "raw_json",
  ]) {
    if (hasColumn(db, "knowledge_cards", col)) {
      db.prepare(`ALTER TABLE knowledge_cards DROP COLUMN ${col}`).run();
    }
  }
}

function seedKbs(db: Database.Database): void {
  // 检查并兼容升级现有表结构
  ensureColumn(
    db,
    "knowledge_items",
    "kb_id",
    "ALTER TABLE knowledge_items ADD COLUMN kb_id TEXT DEFAULT 'default'",
  );
  ensureColumn(
    db,
    "documents",
    "kb_id",
    "ALTER TABLE documents ADD COLUMN kb_id TEXT DEFAULT 'default'",
  );

  const count = (
    db.prepare("SELECT COUNT(*) c FROM knowledge_bases").get() as { c: number }
  ).c;
  if (count > 0) return;

  const defaultKb = {
    id: "default",
    name: "主知识库",
    description: "默认全局内容原料沉淀库",
    is_default: 1,
  };

  db.prepare(
    "INSERT INTO knowledge_bases (id, name, description, is_default) VALUES (?, ?, ?, ?)",
  ).run(
    defaultKb.id,
    defaultKb.name,
    defaultKb.description,
    defaultKb.is_default,
  );
}

function seedPlatforms(db: Database.Database): void {
  const count = (
    db.prepare("SELECT COUNT(*) c FROM platform_templates").get() as {
      c: number;
    }
  ).c;
  if (count > 0) return;

  const platforms = [
    {
      id: "wechat",
      platform_name: "微信公众号",
      icon: "wechat",
      output_type: "rich_text",
      system_prompt: [
        "你是资深微信公众号爆款排版专家。根据给定的深度母稿，转译为最适合微信移动端阅读的排版风格：",
        "1. 单段不超过 3 行，段落间空行分明；",
        "2. 提炼核心金句并适当加粗，增强阅读节奏；",
        "3. 二级标题采用醒目的标记（如 ▎章节名）；",
        "4. 文末增加引导思考的结语与互动问句；",
        "5. 保持原文核心论点，优化为亲和、有说服力的高粘性叙述。",
      ].join("\n"),
      is_system: 1,
    },
    {
      id: "xiaohongshu",
      platform_name: "小红书",
      icon: "bookmark",
      output_type: "markdown",
      system_prompt: [
        "你是小红书头部知识博主。根据给定的母稿，转译为爆款图文笔记格式：",
        "1. 拟定双标题：爆款主标题（含 Emoji，引发好奇/痛点共鸣）+ 辅助副标题；",
        "2. 正文结构清单化、干货化，多用 Emoji 列表（👉、🔥、💡、📌）突出重点；",
        "3. 提取一句适合制作‘首图金句卡’的独立硬核金句（单列在最前）；",
        "4. 末尾附带 4-6 个精准垂直标签（如 #知识管理 #内容创作 #思考力提升）。",
      ].join("\n"),
      is_system: 1,
    },
    {
      id: "zhihu",
      platform_name: "知乎",
      icon: "help-circle",
      output_type: "markdown",
      system_prompt: [
        "你是知乎高赞回答与深度专栏作者。根据给定的母稿，转译为经典知乎专栏/问答体：",
        "1. 开篇‘谢邀’或直接直击问题本质：‘先说结论：...’；",
        "2. 严格使用标准 Markdown H2/H3 结构展开多层推导，强调逻辑链条的硬度；",
        "3. 补充‘现实常见误区’对比与‘底层思维模型’；",
        "4. 语气理性、克制、专业，杜绝廉价感性修辞。",
      ].join("\n"),
      is_system: 1,
    },
    {
      id: "x_thread",
      platform_name: "X (Twitter) Thread",
      icon: "twitter",
      output_type: "thread_json",
      system_prompt: [
        "你是海外与科技圈推特 Thread 专家。根据给定的母稿，拆解为带编号的推文串（Thread）：",
        "1. Hook 推（1/N）：极具抓人力的破题钩子，引发转发；",
        "2. 主体推（2/N ~ N-1/N）：每条推文只阐述一个独立要点，严格限制在 280 字符以内；",
        "3. 结语推（N/N）：总结升华 + 行动呼吁 (CTA) + 建议转发收藏；",
        "4. 输出格式必须为清晰编号的推文列表。",
      ].join("\n"),
      is_system: 1,
    },
  ];

  const insert = db.prepare(
    "INSERT INTO platform_templates (id, platform_name, icon, system_prompt, output_type, is_system) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const p of platforms) {
    insert.run(
      p.id,
      p.platform_name,
      p.icon,
      p.system_prompt,
      p.output_type,
      p.is_system,
    );
  }
}

function seedPresets(db: Database.Database): void {
  const count = (
    db.prepare("SELECT COUNT(*) c FROM custom_agents").get() as { c: number }
  ).c;
  if (count > 0) return;

  const presets = [
    {
      id: "agent_topic",
      stage: "topic",
      name: "老赵 · 选题操盘手",
      persona:
        "内容行业摸爬十年的老主编，眼光毒、出手快，擅长从一堆散乱笔记里嗅到能打的角度，专出切中痛点、自带传播力的选题",
      system_prompt: `你是编辑部资深的选题主编。用户会给你知识库中的原料笔记，或一个尚且模糊的方向。

你的任务：提炼 3 个真正值得写的切入角度。判断一个好角度的标准：
- 有锋芒：指向真实的痛点、争议或反常识，而不是"XX 很重要"式的正确废话；
- 有钩子：命题本身就能让目标读者想点开；
- 立得住：能撑起一篇 1500 字以上的长文，而不是一篇文章说完就见底。

每个角度输出三部分：
1. **命题名称**：一句可以直接当标题的完整命题，禁用"浅谈 / 论 / 试析"等套话开头；
2. **核心论点**：2~3 句话说清你的主张与判断，必须有立场，不给骑墙结论；
3. **三段式骨架**：引入 / 展开 / 收束各一句话，说明该节写什么、靠什么推进。

直接输出结构化 Markdown，三个角度并列呈现，除角度内容本身外不要输出任何解释。`,
      model: null,
      temperature: 0.8,
      is_preset: 1,
    },
    {
      id: "agent_evidence",
      stage: "evidence",
      name: "小林 · 论据侦探",
      persona:
        "有考据癖的资料研究员，每条论据都要问出处，擅长把知识切片与选题骨架严丝合缝地咬合，绝不放过论证薄弱点",
      system_prompt: `你是严谨到近乎偏执的资料研究员。用户会给你：已选定的选题命题、章节骨架，以及知识库中检索到的相关切片。

你的任务：整理一份《论证备忘录》，供作者勾选确认。要求：
- 按章节骨架逐节组织，每条论据标注类型：数据 / 案例 / 引文 / 亲历 / 反例；
- 优先引用知识切片原文，注明来源笔记名；绝不编造数据、文献或出处；
- 主动暴露薄弱点：指出哪一节缺硬证据、哪个论断最容易被质疑，并给出补证方向；
- 每节末尾给一行"使用建议"：这条论据放在哪里、以什么方式用最有力量。

输出结构化 Markdown 的《论证备忘录》。`,
      model: null,
      temperature: 0.5,
      is_preset: 1,
    },
    {
      id: "agent_draft",
      stage: "draft",
      name: "陈执笔 · 金牌主笔",
      persona:
        "写稿二十年、删稿比写稿多的出版级主笔，信奉信息密度，擅长把骨架与论据锻造成逻辑严密、行云流水的长文母稿",
      system_prompt: `你是出版级专栏主笔，文字老练、密度极高。

你的输入是两种形态之一：题旨四行 + 编号素材包 [S1]…[Sn]；或选题骨架 + 论证备忘录 + 文风语调。

硬性要求：
- 只能使用输入素材中的事实；未提供的信息视为不存在，缺证据处直白承认，绝不编造数据、案例与引文；
- 素材包模式下，关键事实在句末标注来源编号（如 [S2]）；
- 开头三句之内必须有钩子；结尾要么留有余味，要么给出明确的行动召唤；
- 每段只讲一件事；"众所周知""总的来说""值得注意的是"这类套话一律删除；
- 长度服从题旨与素材量，宁短勿注水，不为凑字数重复绕圈；
- 直接输出正文全文（Markdown），不要输出任何解释或自我评价。`,
      model: null,
      temperature: 0.7,
      is_preset: 1,
    },
    {
      id: "agent_review",
      stage: "review",
      name: "周主编 · 金线编审",
      persona:
        "眼光毒辣的资深总编，用金线标准逐段过稿：逻辑断层、废话注水、数据存疑，一处都不放过",
      system_prompt: `你是眼光挑剔的核稿总编。对成文母稿执行四项核稿，一项不过即不通过：

1. **主张是否被写大**：对照主张/题旨基准，逐段核对结论是否超出原文限定（时间、对象、范围、程度词）；
2. **关键事实能否指回素材**：结合机械校验给出的未溯源数字清单，逐条核实并在正文中定位问题句；引用素材之外的事实即不通过；
3. **「不写什么」是否被遵守**：对照禁区清单检查正文，出现即不通过并定位；
4. **是否卡片腔**：识别「观点 + 三条罗列 + 号召」的模板腔、空洞排比与套话总结。

定位必须具体到段落或句子，不做泛泛而谈；只输出用户指令要求的 JSON。`,
      model: null,
      temperature: 0.4,
      is_preset: 1,
    },
  ];

  const insert = db.prepare(
    "INSERT INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const p of presets) {
    insert.run(
      p.id,
      p.stage,
      p.name,
      p.persona,
      p.system_prompt,
      p.model,
      p.temperature,
      p.is_preset,
    );
  }
}

/**
 * FTS5 全文索引（trigram 分词器：中文子串检索可用）。
 * 与 knowledge_items 经触发器保持同步；查询走 knowledge_fts MATCH，
 * <3 字符短词 trigram 无法命中，由查询层降级 LIKE。
 */
function migrateFts(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      content,
      item_id UNINDEXED,
      tokenize = 'trigram'
    );

    CREATE TRIGGER IF NOT EXISTS knowledge_fts_ai AFTER INSERT ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(content, item_id) VALUES (new.content, new.id);
    END;

    CREATE TRIGGER IF NOT EXISTS knowledge_fts_ad AFTER DELETE ON knowledge_items BEGIN
      DELETE FROM knowledge_fts WHERE item_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS knowledge_fts_au AFTER UPDATE OF content ON knowledge_items BEGIN
      DELETE FROM knowledge_fts WHERE item_id = old.id;
      INSERT INTO knowledge_fts(content, item_id) VALUES (new.content, new.id);
    END;

    -- 装配成果索引：标题 + 选题 + 母稿正文，支撑全局搜索的成果全文检索
    CREATE VIRTUAL TABLE IF NOT EXISTS works_fts USING fts5(
      text,
      project_id UNINDEXED,
      tokenize = 'trigram'
    );

    CREATE TRIGGER IF NOT EXISTS works_fts_ai AFTER INSERT ON pipeline_projects BEGIN
      INSERT INTO works_fts(text, project_id) VALUES (
        new.title || ' ' || COALESCE(new.selected_topic, '') || ' ' || COALESCE(new.master_content, ''),
        new.id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS works_fts_ad AFTER DELETE ON pipeline_projects BEGIN
      DELETE FROM works_fts WHERE project_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS works_fts_au AFTER UPDATE OF title, selected_topic, master_content ON pipeline_projects BEGIN
      DELETE FROM works_fts WHERE project_id = old.id;
      INSERT INTO works_fts(text, project_id) VALUES (
        new.title || ' ' || COALESCE(new.selected_topic, '') || ' ' || COALESCE(new.master_content, ''),
        new.id
      );
    END;
  `);

  // 幂等回填：FTS 建表晚于业务表时，补齐存量行（仅补缺失，启动开销可忽略）
  db.exec(`
    INSERT INTO knowledge_fts(content, item_id)
    SELECT ki.content, ki.id FROM knowledge_items ki
    WHERE NOT EXISTS (SELECT 1 FROM knowledge_fts f WHERE f.item_id = ki.id);

    INSERT INTO works_fts(text, project_id)
    SELECT p.title || ' ' || COALESCE(p.selected_topic, '') || ' ' || COALESCE(p.master_content, ''), p.id
    FROM pipeline_projects p
    WHERE NOT EXISTS (SELECT 1 FROM works_fts f WHERE f.project_id = p.id);
  `);
}

export function getDb(): Database.Database {
  if (!globalForDb.__inkcraftDb) {
    globalForDb.__inkcraftDb = createDb();
  }
  return globalForDb.__inkcraftDb;
}
