import { ControllerDecorator as Controller, ToolDecorator as Tool, z } from "@nitrostack/core";
import { personaBackendApi } from "../api/client.js";

@Controller("calendar")
export class CalendarController {
  @Tool({
    name: "find_available_times",
    description: "Computes available meeting slots for a given date based on creator's Google Calendar and buffer rules.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Creator identifier"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Target date in YYYY-MM-DD format"),
      durationMinutes: z.number().int().min(1).default(30).describe("Slot duration in minutes (default 30)"),
      timezone: z.string().default("UTC").describe("Visitor IANA timezone"),
    }),
  })
  async findAvailableTimes(input: {
    creatorId?: string;
    date: string;
    durationMinutes?: number;
    timezone?: string;
  }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.findAvailableTimes({
      creatorId,
      date: input.date,
      durationMinutes: input.durationMinutes || 30,
      timezone: input.timezone || "UTC",
    });
  }

  @Tool({
    name: "book_meeting",
    description: "Confirms and books a meeting slot on the creator's Google Calendar with automatic Google Meet creation.",
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator ID"),
      startTime: z.string().describe("Slot start time in ISO-8601 format (e.g. 2026-10-28T14:00:00Z)"),
      endTime: z.string().describe("Slot end time in ISO-8601 format"),
      attendeeEmail: z.string().email().describe("Visitor email address"),
      attendeeName: z.string().describe("Visitor full name"),
      topic: z.string().optional().describe("Meeting topic or consultation notes"),
    }),
  })
  async bookMeeting(input: {
    creatorId?: string;
    startTime: string;
    endTime: string;
    attendeeEmail: string;
    attendeeName: string;
    topic?: string;
  }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.bookMeeting({
      creatorId,
      startTime: input.startTime,
      endTime: input.endTime,
      attendeeEmail: input.attendeeEmail,
      attendeeName: input.attendeeName,
      topic: input.topic,
    });
  }

  @Tool({
    name: "cancel_meeting",
    description: "Cancels a scheduled calendar meeting and notifies participants.",
    inputSchema: z.object({
      creatorId: z.string().optional().describe("Target creator ID"),
      bookingId: z.string().describe("Unique booking or receipt ID"),
      reason: z.string().optional().describe("Reason for cancellation"),
    }),
  })
  async cancelMeeting(input: { creatorId?: string; bookingId: string; reason?: string }) {
    const creatorId = input.creatorId || process.env.CREATOR_ID || "default-creator";
    return await personaBackendApi.cancelMeeting({
      creatorId,
      bookingId: input.bookingId,
      reason: input.reason,
    });
  }
}
