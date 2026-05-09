import { fetchBookingById, updateBookingById } from "./_lib/supabase-admin.js";
import {
  assertKopoKopoConfig,
  createIncomingPayment,
  getKopoKopoConfig,
  getKopoKopoToken,
} from "./_lib/kopokopo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bookingId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    const booking = await fetchBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (!booking.guest_phone) {
      return res.status(400).json({ error: "Guest phone number is missing" });
    }

    if (!booking.total_kes || booking.total_kes <= 0) {
      return res.status(400).json({ error: "Booking total is missing" });
    }

    const config = getKopoKopoConfig(req);
    assertKopoKopoConfig(config);

    const accessToken = await getKopoKopoToken(config);
    const payment = await createIncomingPayment({
      accessToken,
      config,
      booking,
    });

    const updated = await updateBookingById(bookingId, {
      payment_status: "requested",
      payment_provider: "kopokopo",
      payment_phone: booking.guest_phone,
      payment_amount_kes: booking.total_kes,
      payment_requested_at: new Date().toISOString(),
      payment_request_location: payment.location,
      payment_request_id: payment.location ? payment.location.split("/").pop() : null,
    });

    return res.status(200).json({
      success: true,
      booking: updated,
      location: payment.location,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start payment request";
    return res.status(500).json({ error: message });
  }
}
