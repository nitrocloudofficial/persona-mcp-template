# Persona AI - Flag-Based Code-Mode MCP Template

A high-performance Model Context Protocol (MCP) server built with **@nitrostack/core** and **QuickJS WebAssembly sandboxing**.

This template provides dynamic flag-based capability exposure backed by **Persona Core Backend APIs** (which in turn connects to Neon Lakebase Postgres). The MCP service itself has **zero direct database connections** or connection strings; all tool operations, bookings, checkouts, and flag resolutions are securely routed through HTTP REST endpoints on the Persona Core Backend (`PERSONA_BACKEND_URL`).

---

## Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AI CLIENT (Claude / NitroChat)                  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Single-turn JSON-RPC 2.0 / SSE
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             NITROSTACK CODE-MODE MCP SERVICE (:3005)                   │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 CodeModeTransform (QuickJS WASM)               │   │
│   │                                                                │   │
│   │  • search(query)         -> Finds micro-tools dynamically      │   │
│   │  • get_schema(tool_name) -> Returns Zod parameter definitions  │   │
│   │  • execute(script)       -> Executes multi-tool JS script      │   │
│   │                             locally inside isolated sandbox    │   │
│   │  • alwaysVisible:        -> Baseline tools bypass search       │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │ callTool() local dispatch         │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │              DYNAMIC FLAG-GATED CONTROLLER CATALOG             │   │
│   │  [Profile]   ProfileController  (profile_get_persona_profile)  │   │
│   │  [Fallback]  FallbackController (profile_submit_request)       │   │
│   │  [Schedule]  CalendarController (find_available, book, cancel) │   │
│   │  [Commerce]  CommerceController (commerce_start_checkout)      │   │
│   │  [Hiring]    HiringController   (list_open_roles, submit_app)  │   │
│   │  [Dev/OSS]   DevController      (list_contribution_opps)       │   │
│   │  [Context]   ContextController  (search_context, get_item)     │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
└────────────────────────────────────┴───────────────────────────────────┘
                                     │ HTTP REST (PERSONA_BACKEND_URL)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PERSONA CORE BACKEND SERVICE (:3001)                 │
│   Fastify API • Business Logic • Auth Guards • Concurrency Control     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Drizzle ORM / Pooled Connection
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    NEON LAKEBASE POSTGRESQL (neondb)                   │
│  creators  │  google_calendar_connections  │  offerings  │  receipts   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Canonical Tool Registry

| Tool Identifier | Category | Flag Gate | Description |
| :--- | :--- | :--- | :--- |
| `profile_get_persona_profile` | Identity | **Always Visible** | Returns creator profile, headline, bio, and intents |
| `profile_submit_request` | Fallback | **Always Visible** | Universal zero-dependency request capture store |
| `calendar_find_available_times` | Scheduling | `SCHEDULE` + Active GCal | Computes free slots with 15-min buffers |
| `calendar_book_meeting` | Scheduling | `SCHEDULE` + Active GCal | Confirms booking and generates Google Meet |
| `calendar_cancel_meeting` | Scheduling | `SCHEDULE` + Active GCal | Cancels meeting and logs receipt |
| `context_search_context` | Knowledge | Catalog Search | Grounded RAG search over Neon vector chunks |
| `context_get_context_item` | Knowledge | Catalog Search | Retrieves full document metadata and text |
| `commerce_start_checkout` | Commerce | `COMMERCE` + Active Offering | Stripe checkout session with immutable offering IDs |
| `hiring_list_open_roles` | Hiring | `HIRING` Intent | Active job openings and advisory roles |
| `hiring_submit_application` | Hiring | `HIRING` Intent | Captures job applications into hiring triage queue |
| `dev_list_contribution_opportunities` | Dev / OSS | `CONTRIBUTE` Intent | Open contributor issues with PR filtering |

---

## Quick Start

### 1. Configure Environment
Copy `.env.example` to `.env` and set your Persona Backend URL:
```bash
cp .env.example .env
```
Ensure `PERSONA_BACKEND_URL` points to your Persona Core Backend (default `http://localhost:3001`). Note: This MCP service does **NOT** require any `DATABASE_URL`.

### 2. Install & Build
```bash
npm install
npm run build
```

### 3. Start Development Server
```bash
# Starts MCP service with hot-reloading (STDIO + HTTP SSE on port 3005)
npm run dev
```

---

## Connecting Clients

### Claude Desktop / Cursor (`stdio`)
Add to `claude_desktop_config.json` or `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "persona-mcp": {
      "command": "node",
      "args": ["/Users/admin/Desktop/persona-mcp/root1/root2/persona-ai/mcp-template/dist/index.js"],
      "env": {
        "CREATOR_ID": "default-creator",
        "PERSONA_BACKEND_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Remote AI Agents / NitroChat (`SSE / HTTP`)
Set in `.env`:
```env
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3005
```
Or connect via the `/sse` (Server-Sent Events) or `/mcp` (Streamable HTTP) endpoint.
