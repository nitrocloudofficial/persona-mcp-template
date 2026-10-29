import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function parseText(res: any) {
  if (!res || !res.content || !res.content[0]) return null;
  const raw = res.content[0].text;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

describe("Persona AI MCP Template - STDIO Transport & Tools", () => {
  let transport: StdioClientTransport;
  let client: Client;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      env: {
        ...(process.env as Record<string, string>),
        MCP_TRANSPORT_TYPE: "stdio",
        NODE_ENV: "development",
      },
    });
    client = new Client({ name: "stdio-vitest-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    if (transport) {
      await transport.close();
    }
  });

  it("lists exposed tools (Code Mode meta-tools + alwaysVisible)", async () => {
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name);
    expect(names).toContain("search");
    expect(names).toContain("get_schema");
    expect(names).toContain("execute");
    expect(names).toContain("profile_get_persona_profile");
    expect(names).toContain("calendar_find_available_times");
    expect(names).toContain("calendar_book_meeting");
    expect(names).toContain("profile_submit_request");
  });

  it("tests tool: search (BM25 keyword search and browse)", async () => {
    const queryRes = await client.callTool({ name: "search", arguments: { query: "calendar" } });
    const text = (queryRes as any).content[0]?.text || "";
    expect(text).toContain("calendar_find_available_times");

    const browseRes = await client.callTool({ name: "search", arguments: {} });
    const browseText = (browseRes as any).content[0]?.text || "";
    expect(browseText.length).toBeGreaterThan(20);
  });

  it("tests tool: get_schema (JSON Schema introspection)", async () => {
    const res = await client.callTool({
      name: "get_schema",
      arguments: { tools: ["calendar_book_meeting", "hiring_submit_application"] },
    });
    const text = (res as any).content[0]?.text || "";
    expect(text).toContain("calendar_book_meeting");
    expect(text).toContain("hiring_submit_application");
    expect(text).toContain("required");
  });

  it("tests tool: execute (QuickJS WebAssembly sandbox)", async () => {
    const res = await client.callTool({
      name: "execute",
      arguments: { code: "return { test: 'quickjs_ok', sum: 21 * 2 };" },
    });
    const parsed = parseText(res);
    expect(parsed.test).toBe("quickjs_ok");
    expect(parsed.sum).toBe(42);
  });

  it("tests tool: profile_get_persona_profile (direct)", async () => {
    const res = await client.callTool({
      name: "profile_get_persona_profile",
      arguments: { creatorId: "default-creator" },
    });
    const parsed = parseText(res);
    expect(parsed.id).toBe("default-creator");
    expect(parsed.displayName).toBe("Creator");
  });

  it("tests tool: profile_submit_request (direct)", async () => {
    const res = await client.callTool({
      name: "profile_submit_request",
      arguments: {
        creatorId: "default-creator",
        visitorEmail: "vitest-stdio@example.com",
        visitorName: "Vitest Stdio User",
        intentCategory: "GENERAL",
        summary: "Vitest STDIO request test",
      },
    });
    const parsed = parseText(res);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe("PENDING");
    expect(parsed.requestId).toBeDefined();
  });

  it("tests tool: calendar_find_available_times (direct)", async () => {
    const res = await client.callTool({
      name: "calendar_find_available_times",
      arguments: {
        creatorId: "default-creator",
        date: "2026-10-31",
        durationMinutes: 30,
      },
    });
    const parsed = parseText(res);
    expect(parsed.available).toBe(true);
    expect(parsed.slotsCount).toBeGreaterThanOrEqual(8);
  });

  let lastBookingId = "book_vtest";

  it("tests tool: calendar_book_meeting (direct)", async () => {
    const res = await client.callTool({
      name: "calendar_book_meeting",
      arguments: {
        creatorId: "default-creator",
        startTime: "2026-10-31T14:00:00Z",
        endTime: "2026-10-31T14:30:00Z",
        attendeeEmail: "vitest-booking@example.com",
        attendeeName: "Vitest Booking User",
        topic: "STDIO E2E Verification",
      },
    });
    const parsed = parseText(res);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe("CONFIRMED");
    expect(parsed.meetUrl).toBeDefined();
    if (parsed.bookingId) {
      lastBookingId = parsed.bookingId;
    }
  });

  it("tests domain tools via sandbox execution (calendar_cancel, context, commerce, hiring, dev)", async () => {
    // calendar_cancel_meeting
    const cancelRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('calendar_cancel_meeting', { bookingId: '${lastBookingId}', reason: 'Stdio verification' });`,
      },
    });
    expect(parseText(cancelRes).status).toBe("CANCELLED");

    // context_search_context
    const searchRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('context_search_context', { query: 'Postgres', limit: 2 });`,
      },
    });
    expect(parseText(searchRes).results).toBeDefined();

    // context_get_context_item
    const getDocRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('context_get_context_item', { documentId: 'doc_mcp_arch_guide' });`,
      },
    });
    expect(parseText(getDocRes).found).toBe(true);

    // commerce_start_checkout
    const checkoutRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('commerce_start_checkout', { offeringId: 'offering_default_audit', customerEmail: 'vitest@example.com' });`,
      },
    });
    expect(parseText(checkoutRes).success).toBe(true);

    // hiring_list_open_roles
    const rolesRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('hiring_list_open_roles', {});`,
      },
    });
    expect(parseText(rolesRes).count).toBe(2);

    // hiring_submit_application
    const appRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('hiring_submit_application', {
          roleId: 'role_systems_architect',
          candidateName: 'Alex Test',
          candidateEmail: 'alex@example.com',
          resumeUrl: 'https://example.com/alex-cv.pdf'
        });`,
      },
    });
    expect(parseText(appRes).status).toBe("RECEIVED");

    // dev_list_contribution_opportunities
    const devRes = await client.callTool({
      name: "execute",
      arguments: {
        code: `return await callTool('dev_list_contribution_opportunities', {});`,
      },
    });
    expect(parseText(devRes).count).toBe(3);
  });
});

describe("Persona AI MCP Template - HTTP SSE Transport & Tools", () => {
  let srv: ChildProcess;
  let client: Client;
  const port = 3015;

  beforeAll(async () => {
    srv = spawn("node", ["dist/index.js"], {
      env: {
        ...(process.env as Record<string, string>),
        MCP_TRANSPORT_TYPE: "http",
        PORT: String(port),
        HOST: "127.0.0.1",
        NODE_ENV: "development",
      },
      stdio: "ignore",
    });

    await new Promise((r) => setTimeout(r, 1600));

    const sseUrl = new URL(`http://127.0.0.1:${port}/sse`);
    const transport = new SSEClientTransport(sseUrl);
    client = new Client({ name: "http-sse-vitest-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (srv) {
      srv.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 400));
    }
  });

  it("lists exposed tools over HTTP SSE", async () => {
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name);
    expect(names).toContain("search");
    expect(names).toContain("get_schema");
    expect(names).toContain("execute");
    expect(names).toContain("profile_get_persona_profile");
    expect(names).toContain("calendar_find_available_times");
  });

  it("tests meta-tools over HTTP SSE", async () => {
    const searchRes = await client.callTool({ name: "search", arguments: { query: "hiring" } });
    expect((searchRes as any).content[0]?.text).toContain("hiring_list_open_roles");

    const schemaRes = await client.callTool({
      name: "get_schema",
      arguments: { tools: ["commerce_start_checkout"] },
    });
    expect((schemaRes as any).content[0]?.text).toContain("commerce_start_checkout");

    const execRes = await client.callTool({
      name: "execute",
      arguments: { code: "return { http: 'sse_connected', timestamp: Date.now() };" },
    });
    expect(parseText(execRes).http).toBe("sse_connected");
  });

  it("executes multi-tool atomic orchestration pipeline over HTTP SSE", async () => {
    const script = `
      const profile = await callTool('profile_get_persona_profile', {});
      const slots = await callTool('calendar_find_available_times', { date: '2026-10-31' });
      const roles = await callTool('hiring_list_open_roles', {});
      const dev = await callTool('dev_list_contribution_opportunities', {});
      const checkout = await callTool('commerce_start_checkout', { offeringId: 'offering_default_audit', customerEmail: 'buyer@example.com' });
      return {
        creator: profile.displayName,
        availableCount: slots.slotsCount,
        openRoles: roles.count,
        devIssues: dev.count,
        checkoutReady: checkout.success
      };
    `;

    const res = await client.callTool({ name: "execute", arguments: { code: script } });
    const parsed = parseText(res);
    expect(parsed.creator).toBe("Creator");
    expect(parsed.availableCount).toBeGreaterThanOrEqual(8);
    expect(parsed.openRoles).toBe(2);
    expect(parsed.devIssues).toBe(3);
    expect(parsed.checkoutReady).toBe(true);
  });
});

describe("Persona AI MCP Template - Streamable HTTP Transport (/mcp)", () => {
  let srv: ChildProcess;
  let client: Client;
  const port = 3016;

  beforeAll(async () => {
    srv = spawn("node", ["dist/index.js"], {
      env: {
        ...(process.env as Record<string, string>),
        MCP_TRANSPORT_TYPE: "http",
        PORT: String(port),
        HOST: "127.0.0.1",
        NODE_ENV: "development",
      },
      stdio: "ignore",
    });

    await new Promise((r) => setTimeout(r, 1600));

    const mcpUrl = new URL(`http://127.0.0.1:${port}/mcp`);
    const transport = new StreamableHTTPClientTransport(mcpUrl);
    client = new Client({ name: "streamable-vitest-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (srv) {
      srv.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 400));
    }
  });

  it("lists exposed tools over Streamable HTTP (/mcp)", async () => {
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name);
    expect(names).toContain("search");
    expect(names).toContain("execute");
    expect(names).toContain("profile_get_persona_profile");
  });

  it("executes tools over Streamable HTTP (/mcp)", async () => {
    const res = await client.callTool({
      name: "profile_get_persona_profile",
      arguments: { creatorId: "default-creator" },
    });
    expect(parseText(res).displayName).toBe("Creator");

    const execRes = await client.callTool({
      name: "execute",
      arguments: { code: "return await callTool('hiring_list_open_roles', {});" },
    });
    expect(parseText(execRes).count).toBe(2);
  });
});

