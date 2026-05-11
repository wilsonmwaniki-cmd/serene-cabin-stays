import {
  createChargeBatch,
  fetchBookingById,
  fetchChargesByBookingId,
  updateChargeBatchById,
  updateChargesByIds,
} from "./_lib/supabase-admin.js";
import {
  assertKopoKopoConfig,
  createIncomingPayment,
  getKopoKopoConfig,
  getKopoKopoToken,
} from "./_lib/kopokopo.js";

const isCollectibleCharge = (charge) => ["draft", "failed"].includes(String(charge.charge_status || "").toLowerCase());

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

    const charges = (await fetchChargesByBookingId(bookingId)).filter(isCollectibleCharge);
    if (charges.length === 0) {
      return res.status(400).json({ error: "There are no unpaid stay charges to collect" });
    }

    const totalKes = charges.reduce((sum, charge) => sum + Number(charge.amount_kes || 0), 0);
    const batch = await createChargeBatch({
      booking_id: booking.id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      guest_phone: booking.guest_phone,
      description: `Checkout balance for booking ${booking.id.slice(0, 8)}`,
      total_kes: totalKes,
      charge_ids: charges.map((charge) => charge.id),
    });

    const config = getKopoKopoConfig(req);
    assertKopoKopoConfig(config);

    const accessToken = await getKopoKopoToken(config);
    const payment = await createIncomingPayment({
      accessToken,
      config,
      target: {
        id: batch.id,
        guest_name: batch.guest_name,
        guest_email: batch.guest_email,
        guest_phone: batch.guest_phone,
        total_kes: totalKes,
      },
      targetType: "guest_charge_batch",
    });

    const updatedBatch = await updateChargeBatchById(batch.id, {
      batch_status: "requested",
      payment_provider: "kopokopo",
      payment_phone: booking.guest_phone,
      payment_amount_kes: totalKes,
      payment_requested_at: new Date().toISOString(),
      payment_request_location: payment.location,
      payment_request_id: payment.location ? payment.location.split("/").pop() : null,
    });

    await updateChargesByIds(charges.map((charge) => charge.id), {
      charge_status: "requested",
      payment_batch_id: batch.id,
    });

    return res.status(200).json({
      success: true,
      batch: updatedBatch,
      chargeCount: charges.length,
      totalKes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send combined stay payment";
    return res.status(500).json({ error: message });
  }
}
