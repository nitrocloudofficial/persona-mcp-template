/**
 * Creator Intent Enums & Feature Flags
 *
 * Defines the capability gates used by the Dynamic MCP Registry.
 */

export enum CreatorIntent {
  SCHEDULE = "SCHEDULE",
  COMMERCE = "COMMERCE",
  HIRING = "HIRING",
  CONTRIBUTE = "CONTRIBUTE",
  CRM = "CRM",
}

export interface CreatorFlags {
  creatorId: string;
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  intents: CreatorIntent[];
  hasCalendarConnection: boolean;
  hasCommerceOfferings: boolean;
  hasHiringRoles: boolean;
  hasContributionBoard: boolean;
  hasCrmIntegration: boolean;
}

export const DEFAULT_FLAGS: CreatorFlags = {
  creatorId: "default-creator",
  slug: "default",
  displayName: "Creator",
  headline: "AI Persona",
  bio: "Creator Assistant",
  intents: [CreatorIntent.SCHEDULE],
  hasCalendarConnection: false,
  hasCommerceOfferings: false,
  hasHiringRoles: false,
  hasContributionBoard: false,
  hasCrmIntegration: false,
};
