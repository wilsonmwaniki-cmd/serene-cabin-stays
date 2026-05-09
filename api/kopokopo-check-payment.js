import { fetchBookingById, updateBookingById } from "./_lib/supabase-admin.js";
import {
  assertKopoKopoConfig,
  extractIncomingPaymentUpdate,
  fetchIncomingPaymentStatus,
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

    if (!booking.payment_request_location) {
      return res.status(400).json({ error: "This booking does not have a payment request yet" });
    }

    const config = getKopoKopoConfig(req);
    assertKopoKopoConfig(config);
    const accessToken = await getKopoKopoToken(config);
    const payload = await fetchIncomingPaymentStatus({
      accessToken,
      location: booking.payment_request_location,
    });

    const update = extractIncomingPaymentUpdate(payload);
    const updated = await updateBookingById(bookingId, {
      payment_status: update.paymentStatus,
      payment_provider: update.paymentProvider,
      payment_phone: update.paymentPhone || booking.payment_phone || booking.guest_phone,
      payment_amount_kes: update.paymentAmountKes ?? booking.payment_amount_kes ?? booking.total_kes,
      payment_reference: update.paymentReference,
      payment_request_id: update.paymentRequestId || booking.payment_request_id,
      payment_request_location: update.paymentRequestLocation || booking.payment_request_location,
      payment_requested_at: update.paymentRequestedAt || booking.payment_requested_at,
      payment_received_at: update.paymentReceivedAt || booking.payment_received_at,
    });

    return res.status(200).json({ success: true, booking: updated, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check payment status";
    return res.status(500).json({ error: message });
  }
}
