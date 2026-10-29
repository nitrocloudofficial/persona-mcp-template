import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const RESULTS = {
  stdio: { success: 0, failed: 0, details: [] },
  http_sse: { success: 0, failed: 0, details: [] },
  http_streamable: { success: 0, failed: 0, details: [] }
};

function recordResult(mode, toolName, passed, info) {
  const target = RESULTS[mode];
  if (passed) {
    target.success++;
    target.details.push({ tool: toolName, status: 'PASS', info });
    console.log(`  ✓ [${mode.toUpperCase()}] ${toolName}: PASS`);
  } else {
    target.failed++;
    target.details.push({ tool: toolName, status: 'FAIL', info });
    console.error(`  ✗ [${mode.toUpperCase()}] ${toolName}: FAIL - ${info}`);
  }
}

function parseTextContent(res) {
  if (!res || !res.content || !res.content[0]) return null;
  const raw = res.content[0].text;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function runToolSuite(client, mode) {
  console.log(`\n=== Running Full Tool Test Suite for ${mode.toUpperCase()} ===\n`);

  // 1. Tool Listing
  try {
    const list = await client.listTools();
    const toolNames = list.tools.map(t => t.name);
    const hasCodeMode = toolNames.includes('search') && toolNames.includes('get_schema') && toolNames.includes('execute');
    const hasAlwaysVisible = toolNames.includes('profile_get_persona_profile') && toolNames.includes('calendar_find_available_times');
    recordResult(mode, 'tools/list', hasCodeMode && hasAlwaysVisible, `Found ${toolNames.length} exposed tools: ${toolNames.join(', ')}`);
  } catch (err) {
    recordResult(mode, 'tools/list', false, err.message);
  }

  // 2. Meta-Tool: search
  try {
    const res = await client.callTool({ name: 'search', arguments: { query: 'calendar' } });
    const text = res.content[0]?.text || '';
    const pass = text.includes('calendar_find_available_times') || text.includes('calendar_book_meeting');
    recordResult(mode, 'meta_search (query)', pass, `Search returned: ${text.slice(0, 100).replace(/\n/g, ' ')}...`);
  } catch (err) {
    recordResult(mode, 'meta_search (query)', false, err.message);
  }

  // 3. Meta-Tool: search browse (empty query)
  try {
    const res = await client.callTool({ name: 'search', arguments: {} });
    const text = res.content[0]?.text || '';
    const pass = text.length > 20;
    recordResult(mode, 'meta_search (browse)', pass, `Browse returned ${text.split('\n').length} items`);
  } catch (err) {
    recordResult(mode, 'meta_search (browse)', false, err.message);
  }

  // 4. Meta-Tool: get_schema
  try {
    const res = await client.callTool({
      name: 'get_schema',
      arguments: { tools: ['calendar_book_meeting', 'hiring_submit_application', 'commerce_start_checkout'] }
    });
    const text = res.content[0]?.text || '';
    const pass = text.includes('calendar_book_meeting') && text.includes('hiring_submit_application') && text.includes('commerce_start_checkout');
    recordResult(mode, 'meta_get_schema', pass, `Schemas generated for 3 domain tools`);
  } catch (err) {
    recordResult(mode, 'meta_get_schema', false, err.message);
  }

  // 5. Meta-Tool: execute (basic QuickJS evaluation)
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: { code: 'return { status: "sandbox_online", calc: 40 + 2 };' }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.status === 'sandbox_online' && parsed.calc === 42;
    recordResult(mode, 'meta_execute (basic)', pass, `QuickJS evaluated cleanly: calc=${parsed?.calc}`);
  } catch (err) {
    recordResult(mode, 'meta_execute (basic)', false, err.message);
  }

  // 6. Direct Always-Visible Tool: profile_get_persona_profile
  try {
    const res = await client.callTool({
      name: 'profile_get_persona_profile',
      arguments: { creatorId: 'default-creator' }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.id === 'default-creator' && parsed.displayName === 'Creator';
    recordResult(mode, 'profile_get_persona_profile (direct)', pass, `Loaded profile: ${parsed?.displayName} (${parsed?.headline})`);
  } catch (err) {
    recordResult(mode, 'profile_get_persona_profile (direct)', false, err.message);
  }

  // 7. Direct Always-Visible Tool: profile_submit_request
  try {
    const res = await client.callTool({
      name: 'profile_submit_request',
      arguments: {
        creatorId: 'default-creator',
        visitorEmail: 'tester@nitrostack.ai',
        visitorName: 'Automated Tester',
        intentCategory: 'GENERAL',
        summary: `Testing ${mode} direct request submission`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.success === true && parsed.status === 'PENDING' && !!parsed.requestId;
    recordResult(mode, 'profile_submit_request (direct)', pass, `Created native_request with ID: ${parsed?.requestId}`);
  } catch (err) {
    recordResult(mode, 'profile_submit_request (direct)', false, err.message);
  }

  // 8. Direct Always-Visible Tool: calendar_find_available_times
  try {
    const res = await client.callTool({
      name: 'calendar_find_available_times',
      arguments: {
        creatorId: 'default-creator',
        date: '2026-10-31',
        durationMinutes: 30
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.available === true && parsed.slotsCount > 0;
    recordResult(mode, 'calendar_find_available_times (direct)', pass, `Found ${parsed?.slotsCount} available slots on ${parsed?.date}`);
  } catch (err) {
    recordResult(mode, 'calendar_find_available_times (direct)', false, err.message);
  }

  // 9. Direct Always-Visible Tool: calendar_book_meeting
  let lastBookingId = 'book_e2e_test';
  const hourOffset = mode === 'stdio' ? 10 : mode === 'http_sse' ? 11 : 12;
  try {
    const res = await client.callTool({
      name: 'calendar_book_meeting',
      arguments: {
        creatorId: 'default-creator',
        startTime: `2026-11-01T${hourOffset}:00:00Z`,
        endTime: `2026-11-01T${hourOffset}:30:00Z`,
        attendeeEmail: 'tester@nitrostack.ai',
        attendeeName: 'Automated Tester',
        topic: `E2E ${mode} Booking Verification`
      }
    });
    const parsed = parseTextContent(res);
    if (parsed?.bookingId) {
      lastBookingId = parsed.bookingId;
    }
    const pass = parsed && parsed.success === true && parsed.status === 'CONFIRMED' && !!parsed.meetUrl;
    recordResult(mode, 'calendar_book_meeting (direct)', pass, `Meeting confirmed: ${parsed?.bookingId}, Meet: ${parsed?.meetUrl}`);
  } catch (err) {
    recordResult(mode, 'calendar_book_meeting (direct)', false, err.message);
  }

  // 10. Domain Tool via execute: calendar_cancel_meeting
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('calendar_cancel_meeting', { bookingId: '${lastBookingId}', reason: 'Verified via ${mode} suite' });`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.success === true && parsed.status === 'CANCELLED';
    recordResult(mode, 'calendar_cancel_meeting (sandbox execute)', pass, `Booking cancelled: ${parsed?.bookingId}`);
  } catch (err) {
    recordResult(mode, 'calendar_cancel_meeting (sandbox execute)', false, err.message);
  }

  // 11. Domain Tool via execute: context_search_context
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('context_search_context', { query: 'Postgres', limit: 2 });`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && (parsed.count !== undefined || Array.isArray(parsed.results));
    recordResult(mode, 'context_search_context (sandbox execute)', pass, `Returned ${parsed?.count} chunks matching 'Postgres'`);
  } catch (err) {
    recordResult(mode, 'context_search_context (sandbox execute)', false, err.message);
  }

  // 12. Domain Tool via execute: context_get_context_item
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('context_get_context_item', { documentId: 'doc_mcp_arch_guide' });`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.found === true && parsed.document && parsed.document.id === 'doc_mcp_arch_guide';
    recordResult(mode, 'context_get_context_item (sandbox execute)', pass, `Retrieved document: '${parsed?.document?.title}'`);
  } catch (err) {
    recordResult(mode, 'context_get_context_item (sandbox execute)', false, err.message);
  }

  // 13. Domain Tool via execute: commerce_start_checkout
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('commerce_start_checkout', { offeringId: 'offering_default_audit', customerEmail: 'buyer@nitrostack.ai' });`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.success === true && !!parsed.checkoutUrl && parsed.offering?.id === 'offering_default_audit';
    recordResult(mode, 'commerce_start_checkout (sandbox execute)', pass, `Stripe session created: ${parsed?.sessionId}, Offering: ${parsed?.offering?.title} ($${parsed?.offering?.amount})`);
  } catch (err) {
    recordResult(mode, 'commerce_start_checkout (sandbox execute)', false, err.message);
  }

  // 14. Domain Tool via execute: hiring_list_open_roles
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('hiring_list_open_roles', {});`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.count === 2 && Array.isArray(parsed.roles);
    recordResult(mode, 'hiring_list_open_roles (sandbox execute)', pass, `Found ${parsed?.count} roles: ${parsed?.roles?.map(r => r.title).join(', ')}`);
  } catch (err) {
    recordResult(mode, 'hiring_list_open_roles (sandbox execute)', false, err.message);
  }

  // 15. Domain Tool via execute: hiring_submit_application
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('hiring_submit_application', {
          roleId: 'role_systems_architect',
          candidateName: 'Morgan Vance',
          candidateEmail: 'morgan@nitrostack.ai',
          resumeUrl: 'https://drive.google.com/resume-morgan.pdf',
          coverNote: 'Expert in Code-Mode WebAssembly sandboxing.'
        });`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.success === true && parsed.status === 'RECEIVED' && !!parsed.applicationId;
    recordResult(mode, 'hiring_submit_application (sandbox execute)', pass, `Application recorded: ${parsed?.applicationId} (${parsed?.status})`);
  } catch (err) {
    recordResult(mode, 'hiring_submit_application (sandbox execute)', false, err.message);
  }

  // 16. Domain Tool via execute: dev_list_contribution_opportunities
  try {
    const res = await client.callTool({
      name: 'execute',
      arguments: {
        code: `return await callTool('dev_list_contribution_opportunities', {});`
      }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.count === 3 && Array.isArray(parsed.opportunities);
    recordResult(mode, 'dev_list_contribution_opportunities (sandbox execute)', pass, `Found ${parsed?.count} issues: ${parsed?.opportunities?.map(o => o.id).join(', ')}`);
  } catch (err) {
    recordResult(mode, 'dev_list_contribution_opportunities (sandbox execute)', false, err.message);
  }

  // 17. Multi-Tool End-to-End Orchestration Pipeline
  try {
    const script = `
      const profile = await callTool('profile_get_persona_profile', {});
      const slots = await callTool('calendar_find_available_times', { date: '2026-10-31' });
      const roles = await callTool('hiring_list_open_roles', {});
      const dev = await callTool('dev_list_contribution_opportunities', {});
      return {
        creator: profile.displayName,
        intentsCount: profile.intents.length,
        slotsAvailable: slots.slotsCount,
        openRolesCount: roles.count,
        contributionIssuesCount: dev.count
      };
    `;
    const res = await client.callTool({
      name: 'execute',
      arguments: { code: script }
    });
    const parsed = parseTextContent(res);
    const pass = parsed && parsed.creator === 'Creator' && parsed.slotsAvailable >= 8 && parsed.openRolesCount === 2;
    recordResult(mode, 'multi_tool_orchestration (atomic pipeline)', pass, `Aggregated 4 tools atomically: creator='${parsed?.creator}', slots=${parsed?.slotsAvailable}, roles=${parsed?.openRolesCount}, devIssues=${parsed?.contributionIssuesCount}`);
  } catch (err) {
    recordResult(mode, 'multi_tool_orchestration (atomic pipeline)', false, err.message);
  }
}

async function testStdio() {
  console.log('\n========================================');
  console.log('   STARTING STDIO TRANSPORT TEST');
  console.log('========================================');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      MCP_TRANSPORT_TYPE: 'stdio',
      NODE_ENV: 'development'
    }
  });

  const client = new Client(
    { name: 'stdio-test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  await runToolSuite(client, 'stdio');
  await transport.close();
  console.log('\nSTDIO transport session cleanly closed.');
}

async function testHttpSse() {
  console.log('\n========================================');
  console.log('   STARTING HTTP SSE TRANSPORT TEST');
  console.log('========================================');

  const port = 3011;
  const srv = spawn('node', ['dist/index.js'], {
    env: {
      ...process.env,
      MCP_TRANSPORT_TYPE: 'http',
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'development'
    },
    stdio: 'ignore'
  });

  // Wait for server to bind
  await new Promise(r => setTimeout(r, 1600));

  try {
    const sseUrl = new URL(`http://127.0.0.1:${port}/sse`);
    const transport = new SSEClientTransport(sseUrl);
    const client = new Client(
      { name: 'http-sse-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    await runToolSuite(client, 'http_sse');
    await client.close();
    console.log('\nHTTP SSE transport session cleanly closed.');
  } finally {
    srv.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 400));
  }
}

async function testHttpStreamable() {
  console.log('\n========================================');
  console.log('   STARTING STREAMABLE HTTP TRANSPORT TEST');
  console.log('========================================');

  const port = 3012;
  const srv = spawn('node', ['dist/index.js'], {
    env: {
      ...process.env,
      MCP_TRANSPORT_TYPE: 'http',
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'development'
    },
    stdio: 'ignore'
  });

  // Wait for server to bind
  await new Promise(r => setTimeout(r, 1600));

  try {
    const mcpUrl = new URL(`http://127.0.0.1:${port}/mcp`);
    const transport = new StreamableHTTPClientTransport(mcpUrl);
    const client = new Client(
      { name: 'http-streamable-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    await runToolSuite(client, 'http_streamable');
    await client.close();
    console.log('\nStreamable HTTP transport session cleanly closed.');
  } finally {
    srv.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 400));
  }
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 Starting Comprehensive Persona AI MCP Template Test Suite');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    await testStdio();
    await testHttpSse();
    await testHttpStreamable();
  } catch (err) {
    console.error('Fatal test error:', err);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n========================================');
  console.log(`   FINAL SUMMARY REPORT (${durationSec}s)`);
  console.log('========================================');

  for (const [mode, res] of Object.entries(RESULTS)) {
    console.log(`\nMode: [${mode.toUpperCase()}]`);
    console.log(`  Passed: ${res.success} / ${res.success + res.failed}`);
    console.log(`  Failed: ${res.failed}`);
  }

  const totalFailed = Object.values(RESULTS).reduce((acc, r) => acc + r.failed, 0);
  const totalPassed = Object.values(RESULTS).reduce((acc, r) => acc + r.success, 0);

  console.log('\n----------------------------------------');
  console.log(`Total Assertions Passed: ${totalPassed}`);
  console.log(`Total Assertions Failed: ${totalFailed}`);
  console.log('----------------------------------------\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
