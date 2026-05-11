import crypto from "crypto";

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const base64UrlDecode = (value) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

const getPaymentLinkSecret = () =>
  process.env.PAYMENT_LINK_SECRET
  || process.env.KOPOKOPO_CLIENT_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || "";

const sign = (payload) => {
  const secret = getPaymentLinkSecret();
  if (!secret) throw new Error("Payment link secret is not configured");
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payload).digest(),
  );
};

export const createPaymentToken = ({ targetType, targetId, recipientEmail, expiresInDays = 14 }) => {
  const payload = {
    targetType,
    targetId,
    recipientEmail: recipientEmail || null,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyPaymentToken = (token) => {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Payment link is invalid");
  }

  const expected = sign(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Payment link is invalid");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (!payload?.targetType || !payload?.targetId) {
    throw new Error("Payment link is invalid");
  }
  if (payload.exp && Number(payload.exp) < Date.now()) {
    throw new Error("Payment link has expired");
  }

  return payload;
};
