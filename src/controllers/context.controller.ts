import { ControllerDecorator as Controller, ToolDecorator as Tool, z } from "@nitrostack/core";
import { personaBackendApi } from "../api/client.js";

@Controller("context")
export class ContextController {
  @Tool({
    name: "search_context",
    description: "Performs grounded keyword and vector search over creator's ingested documents, RFCs, and wikis.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Creator identifier"),
      query: z.string().describe("Search query string"),
      limit: z.number().int().min(1).default(5).describe("Max search chunks to return"),
    }),
  })
  async searchContext(input: { creatorId?: string; query: string; limit?: number }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.searchContext({
      creatorId,
      query: input.query,
      limit: input.limit || 5,
    });
  }

  @Tool({
    name: "get_context_item",
    description: "Retrieves complete document metadata and text content by document ID.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      documentId: z.string().describe("Unique document ID"),
    }),
  })
  async getContextItem(input: { documentId: string }) {
    return await personaBackendApi.getContextItem(input.documentId);
  }
}
