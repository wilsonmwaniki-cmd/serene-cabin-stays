import {
  fetchChargeBatchById,
  updateChargeBatchById,
  updateChargesByIds,
} from "./_lib/supabase-admin.js";
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
    const { batchId } = req.body || {};
    if (!batchId) {
      return res.status(400).json({ error: "Batch ID is required" });
    }

    const batch = await fetchChargeBatchById(batchId);
    if (!batch) {
      return res.status(404).json({ error: "Charge batch not found" });
    }

    if (!batch.payment_request_location) {
      return res.status(400).json({ error: "This checkout batch does not have a payment request yet" });
    }

    const config = getKopoKopoConfig(req);
    assertKopoKopoConfig(config);
    const accessToken = await getKopoKopoToken(config);
    const payload = await fetchIncomingPaymentStatus({
      accessToken,
      location: batch.payment_request_location,
    });

    const update = extractIncomingPaymentUpdate(payload);
    const updatedBatch = await updateChargeBatchById(batchId, {
      batch_status: update.paymentStatus,
      payment_provider: update.paymentProvider,
      payment_phone: update.paymentPhone || batch.payment_phone || batch.guest_phone,
      payment_amount_kes: update.paymentAmountKes ?? batch.payment_amount_kes ?? batch.total_kes,
      payment_reference: update.paymentReference,
      payment_request_id: update.paymentRequestId || batch.payment_request_id,
      payment_request_location: update.paymentRequestLocation || batch.payment_request_location,
      payment_requested_at: update.paymentRequestedAt || batch.payment_requested_at,
      payment_received_at: update.paymentReceivedAt || batch.payment_received_at,
    });

    const chargeIds = Array.isArray(batch.charge_ids) ? batch.charge_ids.filter((id) => typeof id === "string") : [];
    if (chargeIds.length > 0) {
      await updateChargesByIds(chargeIds, {
        charge_status: update.paymentStatus,
      });
    }

    return res.status(200).json({ success: true, batch: updatedBatch, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check checkout batch status";
    return res.status(500).json({ error: message });
  }
}
