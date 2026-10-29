import { ControllerDecorator as Controller, ToolDecorator as Tool, z } from "@nitrostack/core";
import { personaBackendApi } from "../api/client.js";

@Controller("dev")
export class DevController {
  @Tool({
    name: "list_contribution_opportunities",
    description: "Surfaces open contributor opportunities with mandatory pull request filtering (pull_request === undefined).",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator identifier"),
      tag: z.string().optional().describe("Filter tag, e.g. 'good-first-issue' or 'help-wanted'"),
    }),
  })
  async listContributionOpportunities(input: { creatorId?: string; tag?: string }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.listContributionOpportunities({
      creatorId,
      tag: input.tag,
    });
  }
}
