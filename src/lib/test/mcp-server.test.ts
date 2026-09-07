import assert from "node:assert/strict";
import test from "node:test";
import {
  handleMcpJsonRpc,
  MCP_TOOLS,
  MCP_RESOURCES,
} from "../mcp-server";

test("mcp-server: initialize 握手返回协议版本与能力", async () => {
  const res = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    },
    "Test Agent",
  );

  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 1);
  assert.equal(res.result.serverInfo.name, "inkcraft-mcp-server");
  assert.equal(res.result.serverInfo.authenticatedAs, "Test Agent");
});

test("mcp-server: tools/list 返回 4 大只读工具", async () => {
  const res = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  assert.equal(res.id, 2);
  const tools = res.result.tools;
  assert.equal(tools.length, 4);

  const toolNames = tools.map((t: any) => t.name);
  assert.ok(toolNames.includes("search_cards_by_query"));
  assert.ok(toolNames.includes("get_card_detail"));
  assert.ok(toolNames.includes("list_topics"));
  assert.ok(toolNames.includes("list_recent_works"));
});

test("mcp-server: tools/call 执行 search_cards_by_query", async () => {
  const res = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "search_cards_by_query",
      arguments: {
        query: "工作 认知",
        limit: 3,
      },
    },
  });

  assert.equal(res.id, 3);
  assert.equal(res.result.isError, false);
  const content = JSON.parse(res.result.content[0].text);
  assert.equal(typeof content.total_matched, "number");
  assert.ok(Array.isArray(content.cards));
});

test("mcp-server: resources/list 与 resources/read", async () => {
  const listRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "resources/list",
  });

  assert.equal(listRes.id, 4);
  assert.equal(listRes.result.resources.length, 2);

  const readRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 5,
    method: "resources/read",
    params: {
      uri: "inkcraft://stats/summary",
    },
  });

  assert.equal(readRes.id, 5);
  const stats = JSON.parse(readRes.result.contents[0].text);
  assert.equal(typeof stats.total_atomic_cards, "number");
  assert.equal(typeof stats.total_topics_in_radar, "number");
});
