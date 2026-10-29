import { ControllerDecorator as Controller, ToolDecorator as Tool, z } from "@nitrostack/core";
import { personaBackendApi } from "../api/client.js";

@Controller("commerce")
export class CommerceController {
  @Tool({
    name: "start_checkout",
    description: "Initiates a paid consultation or service package checkout session with tamper-proof immutable offering IDs.",
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator ID"),
      offeringId: z.string().describe("Immutable offering identifier from creator's offerings catalog"),
      customerEmail: z.string().email().describe("Customer contact email address"),
      customerName: z.string().optional().describe("Customer name"),
    }),
  })
  async startCheckout(input: {
    creatorId?: string;
    offeringId: string;
    customerEmail: string;
    customerName?: string;
  }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.startCheckout({
      creatorId,
      offeringId: input.offeringId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
    });
  }
}
