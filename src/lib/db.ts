import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * 单例 SQLite 连接。
 * - 数据文件默认落在项目根 data/inkcraft.sqlite（Docker 部署时挂载卷持久化）
 * - dev 模式 HMR 会反复 import，用 globalThis 缓存连接
 */

const globalForDb = globalThis as unknown as { __inkcraftDb?: Database.Database };

function resolveDbPath(): string {
  if (process.env.INKCRAFT_DB_PATH) return process.env.INKCRAFT_DB_PATH;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "inkcraft.sqlite");
}

function createDb(): Database.Database {
  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
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
  try {
    db.prepare("ALTER TABLE knowledge_items ADD COLUMN kb_id TEXT DEFAULT 'default'").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE documents ADD COLUMN kb_id TEXT DEFAULT 'default'").run();
  } catch {}

  // 笔记修改时间：任何 PATCH 更新时刷新；存量回填为创建时间
  try {
    db.prepare("ALTER TABLE knowledge_items ADD COLUMN updated_at DATETIME").run();
  } catch {}
  db.exec("UPDATE knowledge_items SET updated_at = COALESCE(updated_at, created_at);");

  // 剪藏来源：浏览器插件保存网页时的原文链接
  try {
    db.prepare("ALTER TABLE knowledge_items ADD COLUMN source_url TEXT").run();
  } catch {}

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
      is_preset INTEGER DEFAULT 0
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

    -- 4.9 知识卡片表：文章入库后 AI 萃取的八项结构卡片（绑定单篇笔记）
    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL UNIQUE,
      one_liner TEXT NOT NULL,          -- 1. 一句话观点（灵魂，40-80字）
      audience TEXT NOT NULL,           -- 2. 适用对象 + 场景
      supports TEXT NOT NULL,           -- 3. 三个支撑（JSON：数据/亲历案例/反例边界）
      min_action TEXT NOT NULL,         -- 4. 一个最小行动
      reusable TEXT NOT NULL,           -- 5. 可复用形态（JSON：长文段落/清单/口播/金句图）
      source_note TEXT NOT NULL,        -- 6. 来源与可信度（来源名）
      credibility TEXT NOT NULL,        -- 6. 可信度标记：亲历 / 二手 / 待验证
      self_check TEXT NOT NULL,         -- 7. 一句话自检（三问打勾 JSON）
      golden_line TEXT,                 -- 8. 金句 / 钩子
      raw_json TEXT,
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
  `);

  migrateFts(db);
  seedKbs(db);
  seedPresets(db);
  seedPlatforms(db);
}

function seedKbs(db: Database.Database): void {
  // 检查并兼容升级现有表结构
  try {
    db.prepare("ALTER TABLE knowledge_items ADD COLUMN kb_id TEXT DEFAULT 'default'").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE documents ADD COLUMN kb_id TEXT DEFAULT 'default'").run();
  } catch {}

  const count = (db.prepare("SELECT COUNT(*) c FROM knowledge_bases").get() as { c: number }).c;
  if (count > 0) return;

  const defaultKb = {
    id: "default",
    name: "主知识库",
    description: "默认全局内容原料沉淀库",
    is_default: 1,
  };

  db.prepare(
    "INSERT INTO knowledge_bases (id, name, description, is_default) VALUES (?, ?, ?, ?)"
  ).run(defaultKb.id, defaultKb.name, defaultKb.description, defaultKb.is_default);
}

function seedPlatforms(db: Database.Database): void {
  const count = (db.prepare("SELECT COUNT(*) c FROM platform_templates").get() as { c: number }).c;
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
    "INSERT INTO platform_templates (id, platform_name, icon, system_prompt, output_type, is_system) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const p of platforms) {
    insert.run(p.id, p.platform_name, p.icon, p.system_prompt, p.output_type, p.is_system);
  }
}

function seedPresets(db: Database.Database): void {
  const count = (db.prepare("SELECT COUNT(*) c FROM custom_agents").get() as { c: number }).c;
  if (count > 0) return;

  const presets = [
    {
      id: "agent_topic",
      stage: "topic",
      name: "老赵 · 选题策划",
      persona: "敏锐的内容主编，善于从零散线索中提炼切中痛点、具有传播力的深度选题与章节骨架",
      system_prompt:
        "你是内容工坊的资深选题主编。根据用户提供的知识库原料或方向，提炼 3 个深层切入角度，每个角度包含：命题名称、核心论点、三段式章节骨架。输出清晰结构化的 Markdown 格式。",
      model: null,
      temperature: 0.8,
      is_preset: 1,
    },
    {
      id: "agent_evidence",
      stage: "evidence",
      name: "小林 · 论据研究员",
      persona: "严谨的资料研究员，善于组织论证备忘录，将知识切片与选题骨架精准咬合",
      system_prompt:
        "你是严谨的研究员。根据选定的选题命题和已有知识切片，梳理《论证备忘录》，按章节列出可支撑核心论点的论据、案例与引文，供作者勾选确认。",
      model: null,
      temperature: 0.5,
      is_preset: 1,
    },
    {
      id: "agent_draft",
      stage: "draft",
      name: "陈执笔 · 专栏主笔",
      persona: "文笔老练的出版级专栏主笔，善于把骨架与论据锻造成逻辑严密、行云流水的高密度长文",
      system_prompt:
        "你是专栏主笔。基于选定的选题骨架、用户勾选确认的《论证备忘录》以及指定的文风语调，撰写 1500~3000 字的深度长文母稿。行文结构紧凑、论证有力、拒绝空话套话。",
      model: null,
      temperature: 0.7,
      is_preset: 1,
    },
    {
      id: "agent_review",
      stage: "review",
      name: "周主编 · 金线编审",
      persona: "眼光挑剔的资深总编，严格自检逻辑断层、废话率与事实数据可信度",
      system_prompt:
        "你是严格的总编。对成文母稿执行出版级自检清单：1. 逻辑断层与前后矛盾；2. 信息密度与废话率；3. 事实、数字与引用来源可信度核查。最后输出结构化的审校报告，给出具体的改写与求证建议。",
      model: null,
      temperature: 0.4,
      is_preset: 1,
    },
  ];

  const insert = db.prepare(
    "INSERT INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const p of presets) {
    insert.run(p.id, p.stage, p.name, p.persona, p.system_prompt, p.model, p.temperature, p.is_preset);
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
