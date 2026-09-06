import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapAgent, type AgentRow } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM custom_agents ORDER BY CASE stage 
        WHEN 'wechat' THEN 1 
        WHEN 'xiaohongshu' THEN 2 
        WHEN 'zhihu' THEN 3 
        WHEN 'x_thread' THEN 4 
        WHEN 'master' THEN 5 
        WHEN 'image_gen' THEN 6 
        WHEN 'topic' THEN 7 
        WHEN 'brief' THEN 8 
        WHEN 'evidence' THEN 9 
        WHEN 'draft' THEN 10 
        WHEN 'review' THEN 11 
        WHEN 'extract' THEN 12 
        ELSE 13 END, name`
    )
    .all() as AgentRow[];
  return NextResponse.json({ agents: rows.map(mapAgent) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
  if (!name || !systemPrompt) {
    return NextResponse.json({ error: "技能名称和系统提示词不能为空" }, { status: 400 });
  }

  const id = `custom_${randomUUID()}`;
  const stage = typeof body.stage === "string" && body.stage.trim() ? body.stage.trim() : id;
  const persona = typeof body.persona === "string" ? body.persona.trim() || null : null;
  const model = typeof body.model === "string" ? body.model.trim() || null : null;
  const temperature = typeof body.temperature === "number" && !isNaN(body.temperature)
    ? Math.max(0, Math.min(2, body.temperature))
    : 0.7;

  const db = getDb();
  db.prepare(
    `INSERT INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(id, stage, name, persona, systemPrompt, model, temperature);

  const created = db.prepare("SELECT * FROM custom_agents WHERE id = ?").get(id) as AgentRow;
  return NextResponse.json({ agent: mapAgent(created) }, { status: 201 });
}
