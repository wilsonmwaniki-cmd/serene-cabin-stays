import {
  fetchBookingById,
  fetchChargeBatchById,
  fetchChargeById,
  updateBookingById,
  updateChargeBatchById,
  updateChargeById,
  updateChargesByIds,
} from "./_lib/supabase-admin.js";
import {
  assertKopoKopoConfig,
  createIncomingPayment,
  getKopoKopoConfig,
  getKopoKopoToken,
} from "./_lib/kopokopo.js";
import { verifyPaymentToken } from "./_lib/payment-links.js";

const fetchTargetByToken = async ({ targetType, targetId }) => {
  if (targetType === "booking") {
    const booking = await fetchBookingById(targetId);
    return booking ? { target: booking, kind: "booking" } : null;
  }

  if (targetType === "guest_charge") {
    const charge = await fetchChargeById(targetId);
    return charge ? { target: charge, kind: "guest_charge" } : null;
  }

  if (targetType === "guest_charge_batch") {
    const batch = await fetchChargeBatchById(targetId);
    return batch ? { target: batch, kind: "guest_charge_batch" } : null;
  }

  return null;
};

const sanitizeTargetForClient = ({ target, kind }) => ({
  kind,
  id: target.id,
  guest_name: target.guest_name,
  guest_phone: target.guest_phone,
  guest_email: target.guest_email ?? null,
  amount_kes: target.total_kes ?? target.amount_kes ?? target.payment_amount_kes ?? 0,
  description:
    kind === "booking"
      ? "Booking payment"
      : kind === "guest_charge_batch"
        ? target.description || "Checkout balance"
        : target.description || "Extra bill",
});

const persistRequestedPayment = async ({ kind, target, payment }) => {
  const patch = {
    payment_provider: "kopokopo",
    payment_phone: target.guest_phone,
    payment_amount_kes: target.total_kes ?? target.amount_kes ?? target.payment_amount_kes,
    payment_requested_at: new Date().toISOString(),
    payment_request_location: payment.location,
    payment_request_id: payment.location ? payment.location.split("/").pop() : null,
  };

  if (kind === "booking") {
    await updateBookingById(target.id, {
      ...patch,
      payment_status: "requested",
    });
    return;
  }

  if (kind === "guest_charge") {
    await updateChargeById(target.id, {
      ...patch,
      charge_status: "requested",
    });
    return;
  }

  if (kind === "guest_charge_batch") {
    await updateChargeBatchById(target.id, {
      ...patch,
      batch_status: "requested",
    });
    const chargeIds = Array.isArray(target.charge_ids) ? target.charge_ids.filter((id) => typeof id === "string") : [];
    if (chargeIds.length > 0) {
      await updateChargesByIds(chargeIds, { charge_status: "requested" });
    }
  }
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const token = req.query?.token;
      const payload = verifyPaymentToken(token);
      const found = await fetchTargetByToken(payload);
      if (!found) {
        return res.status(404).json({ error: "Payment item not found" });
      }
      return res.status(200).json({ success: true, target: sanitizeTargetForClient(found) });
    }

    if (req.method === "POST") {
      const { token } = req.body || {};
      const payload = verifyPaymentToken(token);
      const found = await fetchTargetByToken(payload);
      if (!found) {
        return res.status(404).json({ error: "Payment item not found" });
      }

      const config = getKopoKopoConfig(req);
      assertKopoKopoConfig(config);
      const accessToken = await getKopoKopoToken(config);
      const payment = await createIncomingPayment({
        accessToken,
        config,
        target: found.target,
        targetType: found.kind,
      });
      await persistRequestedPayment({ ...found, payment });
      return res.status(200).json({ success: true, location: payment.location });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process payment link";
    return res.status(500).json({ error: message });
  }
}
