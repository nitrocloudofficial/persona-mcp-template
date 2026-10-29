/**
 * Sample Atomic Persona Orchestration Script
 * Executed inside NitroStack QuickJS WebAssembly Sandbox.
 *
 * Demonstrates pipelining:
 * 1. Fetching creator identity & intents
 * 2. Querying live Google Calendar free slots
 * 3. Booking a consultation and generating a Google Meet link
 * ALL IN A SINGLE ATOMIC LLM TURN without multiple prompt round-trips!
 */

async function main() {
  console.log("Starting Persona multi-tool pipeline in QuickJS sandbox...");

  // Step 1: Check creator profile & capabilities
  const profile = await callTool("profile_get_persona_profile", {});
  console.log("Creator loaded:", profile.displayName, "-", profile.headline);

  // Step 2: Check available slots for tomorrow
  const targetDate = "2026-10-28";
  const availability = await callTool("calendar_find_available_times", {
    date: targetDate,
    durationMinutes: 30,
  });

  if (!availability.available || availability.slots.length === 0) {
    console.log("No live slots available, routing to native fallback store...");
    const fallback = await callTool("profile_submit_request", {
      visitorEmail: "lead@enterprise.com",
      visitorName: "Jordan Hayes",
      intentCategory: "SCHEDULE",
      summary: `Meeting requested for ${targetDate} but no slots were open.`,
    });
    return { status: "REQUEST_QUEUED", fallback };
  }

  // Step 3: Atomic Booking of the first slot
  const chosenSlot = availability.slots[0];
  console.log("Booking available slot:", chosenSlot.startTime);

  const booking = await callTool("calendar_book_meeting", {
    startTime: chosenSlot.startTime,
    endTime: chosenSlot.endTime,
    attendeeEmail: "jordan@enterprise.com",
    attendeeName: "Jordan Hayes",
    topic: "Architecture Advisory Consultation",
  });

  return {
    status: "CONFIRMED",
    creator: profile.displayName,
    bookingId: booking.bookingId,
    startTime: booking.startTime,
    endTime: booking.endTime,
    meetUrl: booking.meetUrl,
  };
}

// Sandbox executes this file as an async function body; its return value is the final MCP output.
return await main();
