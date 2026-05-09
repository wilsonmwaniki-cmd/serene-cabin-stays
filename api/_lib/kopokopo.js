const DEFAULT_BASE_URL = "https://sandbox.kopokopo.com";
const DEFAULT_TILL_NUMBER = "3128049";

export const getKopoKopoConfig = (req) => {
  const clientId = process.env.KOPOKOPO_CLIENT_ID;
  const clientSecret = process.env.KOPOKOPO_CLIENT_SECRET;
  const baseUrl = (process.env.KOPOKOPO_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const tillNumber = process.env.KOPOKOPO_TILL_NUMBER || DEFAULT_TILL_NUMBER;
  const callbackUrl = process.env.KOPOKOPO_CALLBACK_URL
    || `${(req.headers["x-forwarded-proto"] || "https").split(",")[0]}://${req.headers.host}/api/kopokopo-callback`;

  return {
    clientId,
    clientSecret,
    baseUrl,
    tillNumber,
    callbackUrl,
  };
};

export const assertKopoKopoConfig = (config) => {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("KopoKopo is not configured yet");
  }
};

export const getKopoKopoToken = async (config) => {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${config.baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "wild-by-lera/1.0",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not get KopoKopo access token");
  }

  const data = await response.json();
  return data.access_token;
};

export const splitGuestName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Guest",
    lastName: parts.slice(1).join(" ") || "Guest",
  };
};

export const createIncomingPayment = async ({ accessToken, config, booking }) => {
  const { firstName, lastName } = splitGuestName(booking.guest_name);

  const response = await fetch(`${config.baseUrl}/api/v2/incoming_payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "wild-by-lera/1.0",
    },
    body: JSON.stringify({
      payment_channel: "M-PESA STK Push",
      till_number: config.tillNumber,
      subscriber: {
        first_name: firstName,
        last_name: lastName,
        phone_number: booking.guest_phone,
        email: booking.guest_email,
      },
      amount: {
        currency: "KES",
        value: booking.total_kes,
      },
      metadata: {
        customer_id: booking.id,
        reference: booking.id.slice(0, 8),
        notes: `Wild by LERA booking ${booking.id}`,
      },
      _links: {
        callback_url: config.callbackUrl,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not start M-Pesa payment request");
  }

  const json = await response.json().catch(() => ({}));
  const location = response.headers.get("location")
    || json?.data?.attributes?._links?.self
    || json?.location
    || null;

  return {
    location,
    payload: json,
  };
};

export const fetchIncomingPaymentStatus = async ({ accessToken, location }) => {
  const response = await fetch(location, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "wild-by-lera/1.0",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not fetch payment status");
  }

  return response.json();
};

export const extractIncomingPaymentUpdate = (payload) => {
  const attributes = payload?.data?.attributes || {};
  const eventResource = attributes?.event?.resource || {};
  const metadata = attributes?.metadata || {};
  const status = String(attributes.status || "").toLowerCase();

  return {
    bookingId: metadata.customer_id || null,
    paymentStatus:
      status === "success" ? "paid"
      : status === "failed" ? "failed"
      : status === "processing" ? "requested"
      : "requested",
    paymentRequestedAt: attributes.initiation_time || null,
    paymentReceivedAt: status === "success" ? eventResource.origination_time || new Date().toISOString() : null,
    paymentPhone: eventResource.sender_phone_number || null,
    paymentAmountKes: eventResource.amount ? Math.round(Number(eventResource.amount)) : null,
    paymentReference: eventResource.reference || null,
    paymentRequestId: payload?.data?.id || null,
    paymentRequestLocation: attributes?._links?.self || null,
    paymentProvider: "kopokopo",
  };
};
