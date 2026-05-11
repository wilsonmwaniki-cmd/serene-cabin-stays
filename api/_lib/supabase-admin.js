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
