import {
  McpApp,
  Module,
  CodeModeTransform,
  DEFAULT_CODE_MODE_SEARCH_DESCRIPTION,
} from "@nitrostack/core";
import { ProfileController } from "./controllers/profile.controller.js";
import { CalendarController } from "./controllers/calendar.controller.js";
import { ContextController } from "./controllers/context.controller.js";
import { CommerceController } from "./controllers/commerce.controller.js";
import { HiringController } from "./controllers/hiring.controller.js";
import { DevController } from "./controllers/dev.controller.js";

/**
 * Root Application Module for Persona MCP Service
 *
 * Utilizes CodeModeTransform from @nitrostack/core to replace the bulky tool catalog
 * with QuickJS WebAssembly meta-tools (search, get_schema, execute).
 * High-frequency creator interactions (profile, calendar slots, bookings)
 * remain directly exposed via `alwaysVisible`.
 */
@McpApp({
  module: AppModule,
  server: {
    name: "persona-mcp-code-mode",
    version: "1.0.0",
  },
  transforms: [
    new CodeModeTransform({
      workerPoolSize: 4,
      memoryLimitMb: 128,
      timeoutMs: 15000,
      allowDestructive: true,
      searchToolDescription: DEFAULT_CODE_MODE_SEARCH_DESCRIPTION,
      alwaysVisible: [
        "profile_get_persona_profile",
        "calendar_find_available_times",
        "calendar_book_meeting",
        "profile_submit_request",
      ],
    }),
  ],
})
@Module({
  name: "app",
  description: "Persona AI Code-Mode MCP Service with Dynamic Flag-Based Integration",
  controllers: [
    ProfileController,
    CalendarController,
    ContextController,
    CommerceController,
    HiringController,
    DevController,
  ],
})
export class AppModule {}
