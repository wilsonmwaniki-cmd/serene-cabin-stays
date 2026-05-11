import { fetchBookingById, fetchChargeBatchById, fetchChargeById, updateBookingById, updateChargeBatchById, updateChargeById, updateChargesByIds } from "./_lib/supabase-admin.js";
import { extractIncomingPaymentUpdate } from "./_lib/kopokopo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const update = extractIncomingPaymentUpdate(payload);

    if (!update.bookingId) {
      return res.status(400).json({ error: "Payment reference is missing" });
    }

    if (update.targetType === "guest_charge_batch") {
      const batch = await fetchChargeBatchById(update.bookingId);
      if (!batch) {
        return res.status(404).json({ error: "Charge batch not found" });
      }

      await updateChargeBatchById(update.bookingId, {
        batch_status: update.paymentStatus,
        payment_provider: update.paymentProvider,
        payment_phone: update.paymentPhone || batch.payment_phone || batch.guest_phone,
        payment_amount_kes: update.paymentAmountKes ?? batch.payment_amount_kes ?? batch.total_kes,
        payment_reference: update.paymentReference,
        payment_request_id: update.paymentRequestId,
        payment_request_location: update.paymentRequestLocation,
        payment_requested_at: update.paymentRequestedAt || batch.payment_requested_at,
        payment_received_at: update.paymentReceivedAt,
      });

      const chargeIds = Array.isArray(batch.charge_ids) ? batch.charge_ids.filter((id) => typeof id === "string") : [];
      if (chargeIds.length > 0) {
        await updateChargesByIds(chargeIds, {
          charge_status: update.paymentStatus,
        });
      }

      return res.status(200).json({ success: true });
    }

    if (update.targetType === "guest_charge") {
      const charge = await fetchChargeById(update.bookingId);
      if (!charge) {
        return res.status(404).json({ error: "Charge not found" });
      }

      await updateChargeById(update.bookingId, {
        charge_status: update.paymentStatus,
        payment_provider: update.paymentProvider,
        payment_phone: update.paymentPhone || charge.payment_phone || charge.guest_phone,
        payment_amount_kes: update.paymentAmountKes ?? charge.payment_amount_kes ?? charge.amount_kes,
        payment_reference: update.paymentReference,
        payment_request_id: update.paymentRequestId,
        payment_request_location: update.paymentRequestLocation,
        payment_requested_at: update.paymentRequestedAt || charge.payment_requested_at,
        payment_received_at: update.paymentReceivedAt,
      });

      return res.status(200).json({ success: true });
    }

    const booking = await fetchBookingById(update.bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await updateBookingById(update.bookingId, {
      payment_status: update.paymentStatus,
      payment_provider: update.paymentProvider,
      payment_phone: update.paymentPhone || booking.payment_phone || booking.guest_phone,
      payment_amount_kes: update.paymentAmountKes ?? booking.payment_amount_kes ?? booking.total_kes,
      payment_reference: update.paymentReference,
      payment_request_id: update.paymentRequestId,
      payment_request_location: update.paymentRequestLocation,
      payment_requested_at: update.paymentRequestedAt || booking.payment_requested_at,
      payment_received_at: update.paymentReceivedAt,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process payment callback";
    return res.status(500).json({ error: message });
  }
}
