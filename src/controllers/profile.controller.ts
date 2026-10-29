import { ControllerDecorator as Controller, ToolDecorator as Tool, z } from "@nitrostack/core";
import { personaBackendApi } from "../api/client.js";

@Controller("profile")
export class ProfileController {
  @Tool({
    name: "get_persona_profile",
    description: "Retrieves creator professional identity, background summary, and enabled interaction intents.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Optional creator ID. Defaults to current persona creator."),
    }),
  })
  async getProfile(input: { creatorId?: string }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    const profile = await personaBackendApi.getCreatorProfile(creatorId);

    return {
      id: profile.id || creatorId,
      slug: profile.slug || "creator",
      displayName: profile.displayName || "Creator",
      headline: profile.headline || "AI Persona",
      bio: profile.bio || "AI Assistant Persona powered by NitroStack Code-Mode",
      intents: profile.enabledIntents || profile.intents || ["SCHEDULE"],
      socialLinks: profile.socialLinks || {},
    };
  }

  @Tool({
    name: "submit_request",
    description: "Universal native fallback request capture store when specialized external tools are unavailable.",
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator ID"),
      visitorEmail: z.string().email().describe("Contact email of the visitor"),
      visitorName: z.string().optional().describe("Full name of the visitor"),
      intentCategory: z.enum(["SCHEDULE", "COMMERCE", "HIRING", "CONTRIBUTE", "GENERAL"]).describe("Primary purpose of request"),
      summary: z.string().describe("Concise summary of request"),
      details: z.record(z.any()).optional().describe("Structured parameters or answers"),
    }),
  })
  async submitRequest(input: {
    creatorId?: string;
    visitorEmail: string;
    visitorName?: string;
    intentCategory: string;
    summary: string;
    details?: Record<string, any>;
  }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.submitRequest({
      creatorId,
      visitorEmail: input.visitorEmail,
      visitorName: input.visitorName,
      intentCategory: input.intentCategory,
      summary: input.summary,
      details: input.details,
    });
  }
}
