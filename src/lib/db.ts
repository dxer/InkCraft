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

    -- 4.9 知识卡片表：文章入库后 AI 萃取的知识卡片（绑定单篇笔记）
    -- 整卡内容就是一份 markdown 文档（content_md），提取规则/提示词可随时改，无需动表结构
    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL UNIQUE,
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
  `);

  migrateFts(db);
  seedKbs(db);
  seedPresets(db);
  seedPlatforms(db);
  migrateKnowledgeCards(db);
}

/**
 * 知识卡片表迁移：整卡 markdown 化。
 * 旧版分字段结构（one_liner/audience/... 十列）→ 合成为整卡 markdown 回填 content_md 后删除遗留列。
 */
function migrateKnowledgeCards(db: Database.Database): void {
  try {
    db.prepare("ALTER TABLE knowledge_cards ADD COLUMN content_md TEXT").run();
  } catch {}

  // 旧版分字段数据先合成 markdown 回填（新装库无这些列，整段跳过）
  try {
    const legacy = db
      .prepare("SELECT * FROM knowledge_cards WHERE content_md IS NULL AND one_liner IS NOT NULL")
      .all() as any[];
    const labels: Record<string, string> = { data: "数据", case: "亲历 · 案例", counter: "反例 · 边界" };
    const quote = (t: string) => t.split("\n").map((l) => `> ${l}`).join("\n");
    for (const r of legacy) {
      const parse = <T,>(s: string | null, fb: T): T => {
        try { return JSON.parse(s || "") as T; } catch { return fb; }
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
        r.golden_line ? quote(r.golden_line) : "*空 —— 写稿时再补上标题或开场。*",
      ].join("\n");
      db.prepare("UPDATE knowledge_cards SET content_md = ? WHERE id = ?").run(md, r.id);
    }
  } catch {}

  // 删除遗留分字段列（SQLite 3.35+ 支持 DROP COLUMN；列不存在时静默跳过）
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
    try {
      db.prepare(`ALTER TABLE knowledge_cards DROP COLUMN ${col}`).run();
    } catch {}
  }
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
      name: "老赵 · 选题操盘手",
      persona: "内容行业摸爬十年的老主编，眼光毒、出手快，擅长从一堆散乱笔记里嗅到能打的角度，专出切中痛点、自带传播力的选题",
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
      persona: "有考据癖的资料研究员，每条论据都要问出处，擅长把知识切片与选题骨架严丝合缝地咬合，绝不放过论证薄弱点",
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
      persona: "写稿二十年、删稿比写稿多的出版级主笔，信奉信息密度，擅长把骨架与论据锻造成逻辑严密、行云流水的长文母稿",
      system_prompt: `你是出版级专栏主笔，文字老练、密度极高。用户会给你：选题骨架、勾选确认的《论证备忘录》，以及指定的文风语调。

你的任务：写出 1500~3000 字的深度长文母稿。硬性要求：
- 严格按骨架行文，论据按备忘录落位，不得偷换论点、不得注水凑字；
- 开头三句之内必须有钩子；结尾要么留有余味，要么给出明确的行动召唤；
- 每段只讲一件事；"众所周知""总的来说""值得注意的是"这类套话一律删除；
- 论证有断层宁可补一句过渡写透，也不留逻辑跳跃给读者猜。

直接输出正文全文（Markdown），不要输出任何解释或自我评价。`,
      model: null,
      temperature: 0.7,
      is_preset: 1,
    },
    {
      id: "agent_review",
      stage: "review",
      name: "周主编 · 金线编审",
      persona: "眼光毒辣的资深总编，用金线标准逐段过稿：逻辑断层、废话注水、数据存疑，一处都不放过",
      system_prompt: `你是眼光挑剔的资深总编，对成文母稿执行出版级终审。逐项检查并输出审校报告：

1. **逻辑断层与前后矛盾**：逐段核对"论点—论据—结论"是否咬合，标出每一处跳跃或自相矛盾；
2. **信息密度与废话率**：圈出可整句删除的空话、重复与注水段落，估算全文废话率；
3. **事实与可信度核查**：列出所有数字、事实与引用，逐条标注 可靠 / 待验证 / 存疑，并给出求证途径。

报告结尾必须给出明确结论：可直接发布 / 修改后发布 / 需要重写；并列出按优先级排序的改写建议——每条引用原文，给出具体改法，不做泛泛而谈。`,
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
