import { describe, it, expect } from "vitest";
import { McpApplicationFactory } from "@nitrostack/core";
import { AppModule } from "../src/app.module.js";
import { getCreatorFlagsFromNeon } from "../src/db/queries.js";

describe("Persona AI Code-Mode MCP Service & Backend API Integration", () => {
  it("resolves creator flags and Google Calendar connection from Backend API", async () => {
    const flags = await getCreatorFlagsFromNeon("default-creator");
    expect(flags).toBeDefined();
    expect(flags.creatorId).toBe("default-creator");
    expect(flags.intents).toContain("SCHEDULE");
    expect(flags.hasCalendarConnection).toBe(true);
  });

  it("registers 11 canonical domain tools under @nitrostack/core", async () => {
    const app = await McpApplicationFactory.create(AppModule);
    const toolsMap = await app.getTools();
    expect(toolsMap.size).toBe(11);

    expect(toolsMap.has("profile_get_persona_profile")).toBe(true);
    expect(toolsMap.has("calendar_find_available_times")).toBe(true);
    expect(toolsMap.has("calendar_book_meeting")).toBe(true);
    expect(toolsMap.has("context_search_context")).toBe(true);
    expect(toolsMap.has("commerce_start_checkout")).toBe(true);
  });

  it("applies CodeModeTransform with search, get_schema, execute, and alwaysVisible tools", async () => {
    const app = await McpApplicationFactory.create(AppModule);
    const transform = app.transforms[0];
    const rawList = Array.from((await app.getTools()).values());
    const transformed = await transform.applyTransform(rawList, { sessionId: "test-session" });

    const toolNames = transformed.map((t) => t.name);
    expect(toolNames).toContain("search");
    expect(toolNames).toContain("get_schema");
    expect(toolNames).toContain("execute");
    expect(toolNames).toContain("profile_get_persona_profile");
    expect(toolNames).toContain("calendar_find_available_times");
    expect(toolNames).toContain("calendar_book_meeting");
    expect(toolNames).toContain("profile_submit_request");
  });

  it("executes multi-tool orchestration script inside QuickJS WebAssembly sandbox", async () => {
    const app = await McpApplicationFactory.create(AppModule);
    const transform = app.transforms[0];
    const rawList = Array.from((await app.getTools()).values());
    const transformed = await transform.applyTransform(rawList, { sessionId: "test-session" });

    const execTool = transformed.find((t) => t.name === "execute");
    expect(execTool).toBeDefined();

    const script = `
      const profile = await callTool('profile_get_persona_profile', {});
      const slots = await callTool('calendar_find_available_times', { date: '2026-10-31' });
      return {
        creator: profile.displayName,
        slotsAvailable: slots.slotsCount
      };
    `;

    const result = (await execTool!.handler({ code: script })) as any;
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.creator).toBe("Creator");
    expect(parsed.slotsAvailable).toBeGreaterThanOrEqual(8);
  });
});
