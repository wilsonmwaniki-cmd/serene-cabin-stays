type SendEmailPayload = {
  templateName:
    | "booking-inquiry-received"
    | "booking-inquiry-admin-alert"
    | "contact-received"
    | "contact-admin-alert"
    | "booking-confirmation"
    | "booking-decline";
  recipientEmail?: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
};

export const sendEmail = async (payload: SendEmailPayload) => {
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Email could not be sent");
  }

  return response.json().catch(() => ({}));
};
