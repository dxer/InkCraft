import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapAgent, type AgentRow } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM custom_agents ORDER BY CASE stage WHEN 'topic' THEN 1 WHEN 'evidence' THEN 2 WHEN 'draft' THEN 3 WHEN 'review' THEN 4 ELSE 5 END, name")
    .all() as AgentRow[];
  return NextResponse.json({ agents: rows.map(mapAgent) });
}
