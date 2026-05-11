import { fetchChargeById, updateChargeById } from "./_lib/supabase-admin.js";
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
    const { chargeId } = req.body || {};
    if (!chargeId) {
      return res.status(400).json({ error: "Charge ID is required" });
    }

    const charge = await fetchChargeById(chargeId);
    if (!charge) {
      return res.status(404).json({ error: "Charge not found" });
    }

    if (!charge.guest_phone) {
      return res.status(400).json({ error: "Guest phone number is missing" });
    }

    if (!charge.amount_kes || charge.amount_kes <= 0) {
      return res.status(400).json({ error: "Charge amount is missing" });
    }

    const config = getKopoKopoConfig(req);
    assertKopoKopoConfig(config);

    const accessToken = await getKopoKopoToken(config);
    const payment = await createIncomingPayment({
      accessToken,
      config,
      target: charge,
      targetType: "guest_charge",
    });

    const updated = await updateChargeById(chargeId, {
      charge_status: "requested",
      payment_provider: "kopokopo",
      payment_phone: charge.guest_phone,
      payment_amount_kes: charge.amount_kes,
      payment_requested_at: new Date().toISOString(),
      payment_request_location: payment.location,
      payment_request_id: payment.location ? payment.location.split("/").pop() : null,
    });

    return res.status(200).json({
      success: true,
      charge: updated,
      location: payment.location,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start payment request";
    return res.status(500).json({ error: message });
  }
}
