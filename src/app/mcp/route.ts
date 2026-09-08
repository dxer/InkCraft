import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifyApiKey } from "@/lib/api-keys";
import { handleMcpJsonRpc } from "@/lib/mcp-server";

export const dynamic = "force-dynamic";

/** 内存中的轻量 SSE 会话连接池 */
const sseSessions = new Map<
  string,
  {
    controller: ReadableStreamDefaultController;
    clientName: string;
    createdAt: number;
  }
>();

// 定期清理超过 2 小时的陈旧 SSE 会话
// SAFETY: globalThis 幂等守卫——dev 模式 HMR 反复执行本模块会积累多个 interval，
// 生产单次加载无影响，与 instrumentation.ts 的注册守卫同一模式
const g = globalThis as { __inkcraftMcpSweeper?: boolean };
if (!g.__inkcraftMcpSweeper) {
  g.__inkcraftMcpSweeper = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sseSessions.entries()) {
      if (now - session.createdAt > 2 * 60 * 60 * 1000) {
        try {
          session.controller.close();
        } catch {}
        sseSessions.delete(id);
      }
    }
  }, 60000);
}

/** 从 Request 中提取并校验 API Key */
function authenticateRequest(req: Request): { valid: boolean; name?: string; keyId?: string } {
  // 1. 从 Authorization: Bearer <key> 提取
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    const verified = verifyApiKey(rawKey);
    if (verified.valid) return verified;
  }

  // 2. 从 x-api-key 提取
  const customHeaderKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key") || "";
  if (customHeaderKey) {
    const verified = verifyApiKey(customHeaderKey);
    if (verified.valid) return verified;
  }

  // 3. 从 URL query param (?apiKey=... 或 ?token=...) 提取 (方便某些不支持自定义 Header 的 SSE 客户端)
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("apiKey") || url.searchParams.get("token") || "";
  if (queryKey) {
    const verified = verifyApiKey(queryKey);
    if (verified.valid) return verified;
  }

  return { valid: false };
}

/**
 * GET /mcp: 标准 MCP Server-Sent Events (SSE) 长连接握手
 */
export async function GET(req: Request) {
  const auth = authenticateRequest(req);
  if (!auth.valid) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "缺少或无效的 InkCraft API Key。请在请求头中携带 'Authorization: Bearer ink_live_...' 或 'x-api-key: ink_live_...'",
      },
      { status: 401 },
    );
  }

  const sessionId = randomUUID();
  const clientName = auth.name || "External Agent";

  const stream = new ReadableStream({
    start(controller) {
      sseSessions.set(sessionId, {
        controller,
        clientName,
        createdAt: Date.now(),
      });

      // 按照 MCP SSE 规范发送 initial endpoint 事件
      const endpointPayload = `/mcp?sessionId=${sessionId}`;
      const msg = `event: endpoint\ndata: ${endpointPayload}\n\n`;
      controller.enqueue(new TextEncoder().encode(msg));
    },
    cancel() {
      sseSessions.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * POST /mcp: 双模接口（支持 SSE 会话消息传递，也支持 Direct JSON-RPC 无状态单次调用）
 */
export async function POST(req: Request) {
  const auth = authenticateRequest(req);
  if (!auth.valid) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Unauthorized: 缺少有效 API Key。请设置 Authorization: Bearer <key> 或 x-api-key: <key>",
        },
      },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    // 1. 无状态模式 (Direct JSON-RPC 2.0) - 未传 sessionId，直接同步返回结果
    if (!sessionId) {
      const response = await handleMcpJsonRpc(body, auth.name);
      return NextResponse.json(response);
    }

    // 2. SSE 会话模式 - 携带 sessionId，处理并向对应的 SSE 客户端推流响应
    const session = sseSessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: body?.id || null,
          error: {
            code: -32001,
            message: `SSE Session '${sessionId}' expired or not found`,
          },
        },
        { status: 404 },
      );
    }

    // 异步执行并写入 SSE stream
    const rpcResult = await handleMcpJsonRpc(body, session.clientName);
    const sseEvent = `event: message\ndata: ${JSON.stringify(rpcResult)}\n\n`;
    session.controller.enqueue(new TextEncoder().encode(sseEvent));

    return new Response("Accepted", { status: 202 });
  } catch (err: any) {
    console.error("[MCP] POST error:", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: `Parse error / Internal server error: ${err?.message || String(err)}`,
        },
      },
      { status: 500 },
    );
  }
}
