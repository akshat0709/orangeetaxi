import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const now = new Date();
  const dispatchWindow = new Date(now.getTime() + 30 * 60 * 1000);
  const expireWindow = new Date(now.getTime() - 10 * 60 * 1000);

  const { data: toDispatch, error } = await supabase
    .from("bookings")
    .select("id, reference, pickup_area, drop_area, customer_id, driver_id, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", dispatchWindow.toISOString())
    .gte("scheduled_at", expireWindow.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dispatched: string[] = [];
  for (const booking of toDispatch || []) {
    // A chauffeur who pre-accepted (claim_scheduled_booking) gets the ride directly; otherwise broadcast.
    const update = booking.driver_id
      ? { status: "accepted", accepted_at: new Date().toISOString() }
      : { status: "searching" };
    const { error: updateError } = await supabase
      .from("bookings")
      .update(update)
      .eq("id", booking.id)
      .eq("status", "scheduled");

    if (!updateError) {
      dispatched.push(booking.reference);
    }
  }

  return new Response(JSON.stringify({ dispatched: dispatched.length, references: dispatched }), {
    headers: { "Content-Type": "application/json" },
  });
});
