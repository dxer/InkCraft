import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * SQLite 完整备份：db.serialize() 生成一致性快照 Buffer，
 * 下载后替换 data/inkcraft.sqlite 即可整体恢复（含全部表与 FTS 索引）。
 */
export async function GET() {
  const db = getDb();
  const buffer = db.serialize();
  const date = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="inkcraft-backup-${date}.sqlite"`,
      "Content-Length": String(buffer.length),
    },
  });
}
