import {
  fetchBookingById,
  fetchChargeBatchById,
  fetchChargeById,
} from "./_lib/supabase-admin.js";
import { createPaymentToken } from "./_lib/payment-links.js";

const fetchTarget = async (targetType, targetId) => {
  if (targetType === "booking") return fetchBookingById(targetId);
  if (targetType === "guest_charge") return fetchChargeById(targetId);
  if (targetType === "guest_charge_batch") return fetchChargeBatchById(targetId);
  return null;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { targetType, targetId, recipientEmail } = req.body || {};

    if (!targetType || !targetId) {
      return res.status(400).json({ error: "Payment target is missing" });
    }

    const target = await fetchTarget(targetType, targetId);
    if (!target) {
      return res.status(404).json({ error: "Payment item not found" });
    }

    const token = createPaymentToken({
      targetType,
      targetId,
      recipientEmail: recipientEmail || target.guest_email || null,
    });

    const siteUrl = process.env.PUBLIC_SITE_URL
      || `${(req.headers["x-forwarded-proto"] || "https").split(",")[0]}://${req.headers.host}`;

    return res.status(200).json({
      success: true,
      payUrl: `${siteUrl}/pay?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create payment link";
    return res.status(500).json({ error: message });
  }
}
