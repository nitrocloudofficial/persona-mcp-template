/**
 * Persona AI Backend API Client
 *
 * Connects the headless MCP server to the Persona Core Backend (Fastify :3001)
 * via authenticated/REST HTTP endpoints.
 *
 * NOTE: The MCP template has ZERO direct database connections. All state,
 * Neon Postgres persistence, Google Calendar sync, and Stripe checkout sessions
 * are mediated exclusively through the core backend API.
 */

import dotenv from "dotenv";

dotenv.config();

const DEFAULT_BACKEND_URL = "http://localhost:3001";

export function getBackendUrl(): string {
  return (
    process.env.PERSONA_BACKEND_URL ||
    process.env.BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/+$/, "");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBackendUrl()}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    if (err.message && err.message.includes("fetch failed")) {
      throw new Error(
        `Unable to connect to Persona Backend at ${url}. Ensure backend is running on port 3001.`
      );
    }
    throw err;
  }
}

export const personaBackendApi = {
  /**
   * Retrieves creator public profile, bio, headline, and capabilities.
   * GET /api/v1/creators/:slug
   */
  async getCreatorProfile(creatorIdOrSlug: string) {
    try {
      const res = await request<{ success: boolean; data: any }>(
        `/api/v1/creators/${encodeURIComponent(creatorIdOrSlug)}`
      );
      return res.data;
    } catch {
      // Fallback object if creator record is not yet initialized
      return {
        id: creatorIdOrSlug,
        slug: creatorIdOrSlug,
        displayName: "Creator",
        headline: "AI Persona",
        bio: "AI Assistant Persona powered by NitroStack Code-Mode",
        intents: ["SCHEDULE"],
        capabilities: ["calendar:book", "context:search"],
      };
    }
  },

  /**
   * Universal native request capture store when specialized external tools are unavailable.
   * POST /api/v1/requests
   */
  async submitRequest(payload: {
    creatorId?: string;
    visitorEmail: string;
    visitorName?: string;
    intentCategory: string;
    summary: string;
    details?: Record<string, any>;
  }) {
    const res = await request<{
      success: boolean;
      requestId: string;
      status: string;
      message: string;
    }>("/api/v1/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Computes available meeting slots for a given date based on Google Calendar and buffer rules.
   * POST /api/v1/calendar/available-slots
   */
  async findAvailableTimes(payload: {
    creatorId?: string;
    date: string;
    durationMinutes?: number;
    timezone?: string;
  }) {
    const res = await request<{
      success: boolean;
      data: {
        creatorId: string;
        durationMinutes: number;
        timezone: string;
        totalSlots: number;
        slots: Array<{ start: string; end: string }>;
      };
    }>("/api/v1/calendar/available-slots", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      available: res.data.totalSlots > 0,
      creatorId: res.data.creatorId,
      date: payload.date,
      timezone: res.data.timezone || "UTC",
      slotsCount: res.data.totalSlots,
      slots: res.data.slots.map((s) => ({
        startTime: s.start,
        endTime: s.end,
        durationMinutes: payload.durationMinutes || 30,
      })),
    };
  },

  /**
   * Confirms and books a meeting slot on the creator's Google Calendar with automatic Google Meet creation.
   * POST /api/v1/calendar/book
   */
  async bookMeeting(payload: {
    creatorId?: string;
    startTime: string;
    endTime: string;
    attendeeEmail: string;
    attendeeName: string;
    topic?: string;
  }) {
    const res = await request<{
      success: boolean;
      message: string;
      data: {
        receiptId: string;
        providerRefId: string;
        status: string;
        summary: string;
        startTime: string;
        endTime: string;
        attendeeEmail: string;
        hangoutLink?: string;
        htmlLink?: string;
        createdAt: string;
      };
    }>("/api/v1/calendar/book", {
      method: "POST",
      body: JSON.stringify({
        creatorId: payload.creatorId || "default-creator",
        summary: `Meeting with ${payload.attendeeName}: ${payload.topic || "Consultation"}`,
        startTime: payload.startTime,
        endTime: payload.endTime,
        attendeeEmail: payload.attendeeEmail,
      }),
    });

    return {
      success: true,
      bookingId: res.data.receiptId,
      status: res.data.status,
      meetUrl: res.data.hangoutLink || "https://meet.google.com/new",
      startTime: res.data.startTime,
      endTime: res.data.endTime,
      attendeeEmail: res.data.attendeeEmail,
      message: res.message || "Meeting confirmed and Google Meet generated.",
    };
  },

  /**
   * Cancels a scheduled calendar meeting.
   * POST /api/v1/calendar/cancel
   */
  async cancelMeeting(payload: {
    creatorId?: string;
    bookingId: string;
    reason?: string;
  }) {
    const res = await request<{
      success: boolean;
      bookingId: string;
      status: string;
      message: string;
    }>("/api/v1/calendar/cancel", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Grounded keyword and vector search over creator's ingested documents, RFCs, and wikis.
   * GET /api/v1/context/search
   */
  async searchContext(params: {
    creatorId?: string;
    query: string;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams({
      q: params.query,
      creatorId: params.creatorId || "default-creator",
      limit: String(params.limit || 5),
    });

    const res = await request<{
      success: boolean;
      data: {
        query: string;
        count: number;
        results: Array<{
          chunkId: string;
          documentId: string;
          title: string;
          sourceType: string;
          snippet: string;
        }>;
      };
    }>(`/api/v1/context/search?${queryParams.toString()}`);

    return {
      query: res.data.query,
      count: res.data.count,
      results: res.data.results || [],
    };
  },

  /**
   * Retrieves complete document metadata and text content by document ID.
   * GET /api/v1/context/documents/:id
   */
  async getContextItem(documentId: string) {
    const res = await request<{
      success: boolean;
      found: boolean;
      document: {
        id: string;
        title: string;
        sourceType: string;
        mimeType: string;
        createdAt: string;
        content: string;
      };
    }>(`/api/v1/context/documents/${encodeURIComponent(documentId)}`);

    return res;
  },

  /**
   * Initiates a paid consultation or service package checkout session with tamper-proof offering IDs.
   * POST /api/v1/commerce/checkout
   */
  async startCheckout(payload: {
    creatorId?: string;
    offeringId: string;
    customerEmail: string;
    customerName?: string;
  }) {
    const res = await request<{
      success: boolean;
      sessionId: string;
      checkoutUrl: string;
      offering: {
        id: string;
        title: string;
        amount: number;
        currency: string;
      };
      customerEmail: string;
      message: string;
    }>("/api/v1/commerce/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Lists active job openings and advisory roles.
   * GET /api/v1/hiring/roles
   */
  async listOpenRoles(params: { creatorId?: string; department?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.creatorId) queryParams.set("creatorId", params.creatorId);
    if (params.department) queryParams.set("department", params.department);

    const qs = queryParams.toString();
    const res = await request<{
      success: boolean;
      count: number;
      roles: Array<{
        id: string;
        title: string;
        department: string;
        location: string;
        commitment: string;
        summary: string;
      }>;
    }>(`/api/v1/hiring/roles${qs ? `?${qs}` : ""}`);

    return {
      count: res.count,
      roles: res.roles,
    };
  },

  /**
   * Captures candidate job application into the hiring triage queue.
   * POST /api/v1/hiring/apply
   */
  async submitApplication(payload: {
    creatorId?: string;
    roleId: string;
    candidateName: string;
    candidateEmail: string;
    resumeUrl: string;
    coverNote?: string;
  }) {
    const res = await request<{
      success: boolean;
      applicationId: string;
      status: string;
      message: string;
    }>("/api/v1/hiring/apply", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Surfaces open contributor opportunities with PR filtering.
   * GET /api/v1/dev/opportunities
   */
  async listContributionOpportunities(params: { creatorId?: string; tag?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.creatorId) queryParams.set("creatorId", params.creatorId);
    if (params.tag) queryParams.set("tag", params.tag);

    const qs = queryParams.toString();
    const res = await request<{
      success: boolean;
      count: number;
      opportunities: Array<{
        id: string;
        repo: string;
        title: string;
        labels: string[];
        difficulty: string;
        link: string;
      }>;
    }>(`/api/v1/dev/opportunities${qs ? `?${qs}` : ""}`);

    return {
      count: res.count,
      opportunities: res.opportunities,
    };
  },
};

