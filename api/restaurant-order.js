import {
  createCharge,
  createRestaurantOrder,
  createRestaurantOrderItems,
  fetchActiveRestaurantMenuItemsByIds,
  fetchBookingForGuest,
  updateChargeById,
} from "./_lib/supabase-admin.js";
import {
  assertKopoKopoConfig,
  createIncomingPayment,
  getKopoKopoConfig,
  getKopoKopoToken,
} from "./_lib/kopokopo.js";

const normalizeItems = (items) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          menu_item_id: typeof item?.menu_item_id === "string" ? item.menu_item_id : "",
          quantity: Math.max(0, Number(item?.quantity ?? 0)),
          special_request: typeof item?.special_request === "string" ? item.special_request.trim() : "",
        }))
        .filter((item) => item.menu_item_id && item.quantity > 0)
    : [];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const guestName = String(body.guest_name || "").trim();
    const guestEmail = String(body.guest_email || "").trim().toLowerCase();
    const guestPhone = String(body.guest_phone || "").trim();
    const notes = String(body.notes || "").trim();
    const paymentPreference = body.payment_preference === "pay_now" ? "pay_now" : "bill_later";
    const items = normalizeItems(body.items);

    if (!guestName || !guestPhone) {
      return res.status(400).json({ error: "Guest name and phone are required" });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "Choose at least one menu item" });
    }

    const menuItems = await fetchActiveRestaurantMenuItemsByIds(items.map((item) => item.menu_item_id));
    if (menuItems.length === 0) {
      return res.status(400).json({ error: "Could not find any active menu items for this order" });
    }

    const menuMap = new Map(menuItems.map((item) => [item.id, item]));
    const orderItems = items
      .map((item) => {
        const menuItem = menuMap.get(item.menu_item_id);
        if (!menuItem) return null;
        return {
          menu_item_id: menuItem.id,
          item_name: menuItem.title,
          quantity: item.quantity,
          unit_price_kes: menuItem.price_kes,
          line_total_kes: menuItem.price_kes * item.quantity,
          special_request: item.special_request || null,
        };
      })
      .filter(Boolean);

    if (orderItems.length === 0) {
      return res.status(400).json({ error: "The selected items are no longer available" });
    }

    const totalKes = orderItems.reduce((sum, item) => sum + item.line_total_kes, 0);
    const booking = await fetchBookingForGuest({ guestEmail, guestPhone });

    const order = await createRestaurantOrder({
      booking_id: booking?.id ?? null,
      guest_name: guestName,
      guest_email: guestEmail || null,
      guest_phone: guestPhone,
      payment_preference: paymentPreference,
      total_kes: totalKes,
      notes: notes || null,
    });

    await createRestaurantOrderItems(
      orderItems.map((item) => ({
        order_id: order.id,
        ...item,
      })),
    );

    const charge = await createCharge({
      booking_id: booking?.id ?? null,
      business_area: "restaurant",
      guest_name: guestName,
      guest_email: guestEmail || null,
      guest_phone: guestPhone,
      description: `Restaurant order ${order.id.slice(0, 8)}`,
      amount_kes: totalKes,
      notes: notes || null,
      source_kind: "restaurant_order",
      source_order_id: order.id,
    });

    let promptSent = false;
    let promptError = null;

    if (paymentPreference === "pay_now") {
      try {
        const config = getKopoKopoConfig(req);
        assertKopoKopoConfig(config);
        const accessToken = await getKopoKopoToken(config);
        const payment = await createIncomingPayment({
          accessToken,
          config,
          target: charge,
          targetType: "guest_charge",
        });

        await updateChargeById(charge.id, {
          charge_status: "requested",
          payment_provider: "kopokopo",
          payment_phone: guestPhone,
          payment_amount_kes: totalKes,
          payment_requested_at: new Date().toISOString(),
          payment_request_location: payment.location,
          payment_request_id: payment.location ? payment.location.split("/").pop() : null,
        });
        promptSent = true;
      } catch (error) {
        promptError = error instanceof Error ? error.message : "Could not send payment prompt";
      }
    }

    return res.status(200).json({
      success: true,
      orderId: order.id,
      linkedBookingId: booking?.id ?? null,
      chargeId: charge.id,
      totalKes,
      promptSent,
      promptError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not place restaurant order";
    return res.status(500).json({ error: message });
  }
}
