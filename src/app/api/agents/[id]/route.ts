import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapAgent, type AgentRow } from "@/lib/mappers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof body.name === "string" && body.name.trim()) {
    sets.push("name = ?");
    values.push(body.name.trim());
  }
  if (body.persona !== undefined) {
    sets.push("persona = ?");
    values.push(typeof body.persona === "string" ? body.persona.trim() || null : null);
  }
  if (typeof body.systemPrompt === "string" && body.systemPrompt.trim()) {
    sets.push("system_prompt = ?");
    values.push(body.systemPrompt.trim());
  }
  if (body.model !== undefined) {
    sets.push("model = ?");
    values.push(typeof body.model === "string" ? body.model.trim() || null : null);
  }
  if (typeof body.temperature === "number" && !isNaN(body.temperature)) {
    sets.push("temperature = ?");
    values.push(Math.max(0, Math.min(2, body.temperature)));
  }
  if (typeof body.enabled === "boolean") {
    sets.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const db = getDb();
  const res = db
    .prepare(`UPDATE custom_agents SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, id);

  if (res.changes === 0) {
    return NextResponse.json({ error: "工位不存在" }, { status: 404 });
  }

  const row = db.prepare("SELECT * FROM custom_agents WHERE id = ?").get(id) as AgentRow;
  return NextResponse.json({ agent: mapAgent(row) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const res = db.prepare("DELETE FROM custom_agents WHERE id = ?").run(id);
  if (res.changes === 0) {
    return NextResponse.json({ error: "技能不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
