const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin is not configured");
  }

  return { url, serviceRoleKey };
};

const supabaseRequest = async (path, { method = "GET", body } = {}) => {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase request failed");
  }

  if (response.status === 204) return null;
  return response.json();
};

export const fetchBookingById = async (bookingId) => {
  const rows = await supabaseRequest(
    `bookings?select=*&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
  );

  return Array.isArray(rows) ? rows[0] ?? null : null;
};

export const updateBookingById = async (bookingId, patch) => {
  const rows = await supabaseRequest(
    `bookings?id=eq.${encodeURIComponent(bookingId)}`,
    { method: "PATCH", body: patch },
  );

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const fetchChargeById = async (chargeId) => {
  const rows = await supabaseRequest(
    `guest_charges?select=*&id=eq.${encodeURIComponent(chargeId)}&limit=1`,
  );

  return Array.isArray(rows) ? rows[0] ?? null : null;
};

export const updateChargeById = async (chargeId, patch) => {
  const rows = await supabaseRequest(
    `guest_charges?id=eq.${encodeURIComponent(chargeId)}`,
    { method: "PATCH", body: patch },
  );

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const createCharge = async (payload) => {
  const rows = await supabaseRequest("guest_charges", {
    method: "POST",
    body: payload,
  });

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const updateChargesByIds = async (chargeIds, patch) => {
  if (!Array.isArray(chargeIds) || chargeIds.length === 0) return [];
  const rows = await supabaseRequest(
    `guest_charges?id=in.(${chargeIds.map((id) => encodeURIComponent(id)).join(",")})`,
    { method: "PATCH", body: patch },
  );

  return Array.isArray(rows) ? rows : [];
};

export const fetchChargesByBookingId = async (bookingId) => {
  const rows = await supabaseRequest(
    `guest_charges?select=*&booking_id=eq.${encodeURIComponent(bookingId)}&order=created_at.desc`,
  );

  return Array.isArray(rows) ? rows : [];
};

export const fetchChargeBatchById = async (batchId) => {
  const rows = await supabaseRequest(
    `guest_charge_batches?select=*&id=eq.${encodeURIComponent(batchId)}&limit=1`,
  );

  return Array.isArray(rows) ? rows[0] ?? null : null;
};

export const createChargeBatch = async (payload) => {
  const rows = await supabaseRequest("guest_charge_batches", {
    method: "POST",
    body: payload,
  });

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const updateChargeBatchById = async (batchId, patch) => {
  const rows = await supabaseRequest(
    `guest_charge_batches?id=eq.${encodeURIComponent(batchId)}`,
    { method: "PATCH", body: patch },
  );

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const fetchBookingForGuest = async ({ guestEmail, guestPhone }) => {
  let rows = [];

  if (guestEmail) {
    rows = await supabaseRequest(
      `bookings?select=*&guest_email=eq.${encodeURIComponent(guestEmail)}&status=in.(pending,confirmed)&order=created_at.desc&limit=5`,
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const matchedByPhone = guestPhone
        ? rows.find((row) => String(row.guest_phone || "").replace(/\D/g, "") === String(guestPhone).replace(/\D/g, ""))
        : null;
      return matchedByPhone ?? rows[0];
    }
  }

  if (guestPhone) {
    rows = await supabaseRequest(
      `bookings?select=*&guest_phone=eq.${encodeURIComponent(guestPhone)}&status=in.(pending,confirmed)&order=created_at.desc&limit=5`,
    );
    if (Array.isArray(rows) && rows.length > 0) return rows[0];
  }

  return null;
};

export const fetchActiveRestaurantMenuItemsByIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const rows = await supabaseRequest(
    `restaurant_menu_items?select=*&id=in.(${ids.map((id) => encodeURIComponent(id)).join(",")})&is_active=eq.true&order=section.asc,display_order.asc,title.asc`,
  );

  return Array.isArray(rows) ? rows : [];
};

export const createRestaurantOrder = async (payload) => {
  const rows = await supabaseRequest("restaurant_orders", {
    method: "POST",
    body: payload,
  });

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const updateRestaurantOrderById = async (orderId, patch) => {
  const rows = await supabaseRequest(
    `restaurant_orders?id=eq.${encodeURIComponent(orderId)}`,
    { method: "PATCH", body: patch },
  );

  return Array.isArray(rows) ? rows[0] ?? null : rows;
};

export const createRestaurantOrderItems = async (payload) => {
  const rows = await supabaseRequest("restaurant_order_items", {
    method: "POST",
    body: payload,
  });

  return Array.isArray(rows) ? rows : [];
};

export const fetchRestaurantOrderItemsByOrderIds = async (orderIds) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
  const rows = await supabaseRequest(
    `restaurant_order_items?select=*&order_id=in.(${orderIds.map((id) => encodeURIComponent(id)).join(",")})&order=created_at.asc`,
  );

  return Array.isArray(rows) ? rows : [];
};
