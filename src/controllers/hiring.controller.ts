import { ControllerDecorator as Controller, ToolDecorator as Tool, z } from "@nitrostack/core";
import { personaBackendApi } from "../api/client.js";

@Controller("hiring")
export class HiringController {
  @Tool({
    name: "list_open_roles",
    description: "Lists active job openings and advisory roles currently accepting candidate applications.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator identifier"),
      department: z.string().optional().describe("Filter by department (e.g. Engineering, Product)"),
    }),
  })
  async listOpenRoles(input: { creatorId?: string; department?: string }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.listOpenRoles({
      creatorId,
      department: input.department,
    });
  }

  @Tool({
    name: "submit_application",
    description: "Captures candidate job applications into the hiring inbox pipeline without automated rejection emails.",
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator identifier"),
      roleId: z.string().describe("Target role identifier"),
      candidateName: z.string().describe("Candidate full name"),
      candidateEmail: z.string().email().describe("Candidate contact email"),
      resumeUrl: z.string().url().describe("Public URL or Drive link to candidate resume/CV"),
      coverNote: z.string().optional().describe("Brief statement of interest and background"),
    }),
  })
  async submitApplication(input: {
    creatorId?: string;
    roleId: string;
    candidateName: string;
    candidateEmail: string;
    resumeUrl: string;
    coverNote?: string;
  }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.submitApplication({
      creatorId,
      roleId: input.roleId,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail,
      resumeUrl: input.resumeUrl,
      coverNote: input.coverNote,
    });
  }
}
