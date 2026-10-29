import { personaBackendApi } from "../api/client.js";
import { CreatorFlags, CreatorIntent, DEFAULT_FLAGS } from "../config/flags.js";

/**
 * Resolves creator flags and active capability states dynamically from Persona Backend API.
 * The MCP service has ZERO direct database connections.
 */
export async function getCreatorFlags(creatorId: string): Promise<CreatorFlags> {
  try {
    const creator = await personaBackendApi.getCreatorProfile(creatorId);

    const rawIntents = Array.isArray(creator?.enabledIntents)
      ? creator.enabledIntents
      : Array.isArray(creator?.intents)
      ? creator.intents
      : ["SCHEDULE"];

    const intents: CreatorIntent[] = rawIntents.map((i: string) => i.toUpperCase() as CreatorIntent);

    const hasCalendarConnection = creator?.capabilities?.scheduling ?? true;
    const hasCommerceOfferings = creator?.capabilities?.commerce ?? true;

    return {
      creatorId: creator?.id || creatorId,
      slug: creator?.slug || "creator",
      displayName: creator?.displayName || "Creator",
      headline: creator?.headline || "AI Persona",
      bio: creator?.bio || "AI Assistant Persona",
      intents,
      hasCalendarConnection,
      hasCommerceOfferings,
      hasHiringRoles: intents.includes(CreatorIntent.HIRING),
      hasContributionBoard: intents.includes(CreatorIntent.CONTRIBUTE),
      hasCrmIntegration: intents.includes(CreatorIntent.CRM),
    };
  } catch (err) {
    console.warn(`[MCP Resolver] Warning: Could not fetch creator flags from Backend API, using defaults:`, err);
    return {
      ...DEFAULT_FLAGS,
      creatorId,
    };
  }
}

/** Backward compatible alias */
export const getCreatorFlagsFromNeon = getCreatorFlags;
