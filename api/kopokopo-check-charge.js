import { fetchChargeById, updateChargeById } from "./_lib/supabase-admin.js";
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
    const { chargeId } = req.body || {};
    if (!chargeId) {
      return res.status(400).json({ error: "Charge ID is required" });
    }

    const charge = await fetchChargeById(chargeId);
    if (!charge) {
      return res.status(404).json({ error: "Charge not found" });
    }

    if (!charge.payment_request_location) {
      return res.status(400).json({ error: "This bill does not have a payment request yet" });
    }

    const config = getKopoKopoConfig(req);
    assertKopoKopoConfig(config);
    const accessToken = await getKopoKopoToken(config);
    const payload = await fetchIncomingPaymentStatus({
      accessToken,
      location: charge.payment_request_location,
    });

    const update = extractIncomingPaymentUpdate(payload);
    const updated = await updateChargeById(chargeId, {
      charge_status: update.paymentStatus,
      payment_provider: update.paymentProvider,
      payment_phone: update.paymentPhone || charge.payment_phone || charge.guest_phone,
      payment_amount_kes: update.paymentAmountKes ?? charge.payment_amount_kes ?? charge.amount_kes,
      payment_reference: update.paymentReference,
      payment_request_id: update.paymentRequestId || charge.payment_request_id,
      payment_request_location: update.paymentRequestLocation || charge.payment_request_location,
      payment_requested_at: update.paymentRequestedAt || charge.payment_requested_at,
      payment_received_at: update.paymentReceivedAt || charge.payment_received_at,
    });

    return res.status(200).json({ success: true, charge: updated, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check payment status";
    return res.status(500).json({ error: message });
  }
}
