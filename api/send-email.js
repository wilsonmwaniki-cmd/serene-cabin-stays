import nodemailer from "nodemailer";

const SITE_NAME = "Wild by LERA";
const ALERT_EMAIL = "bookings@lera.co.ke";
const CONTACT_PHONE = "+254725744695";
const PAYMENT_TILL = "3128049";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderTemplate = (templateName, data = {}) => {
  const name = escapeHtml(data.name || "Guest");
  const email = escapeHtml(data.email || "");
  const phone = escapeHtml(data.phone || "");
  const podName = escapeHtml(data.podName || "");
  const checkIn = escapeHtml(data.checkIn || "");
  const checkOut = escapeHtml(data.checkOut || "");
  const notes = escapeHtml(data.notes || "");
  const subject = escapeHtml(data.subject || "");
  const message = escapeHtml(data.message || "");
  const promoCode = escapeHtml(data.promoCode || "");
  const adults = Number(data.adults ?? 0);
  const children = Number(data.children ?? 0);
  const rooms = Number(data.rooms ?? 1);
  const subtotalKes = Number(data.subtotalKes ?? 0);
  const discountKes = Number(data.discountKes ?? 0);
  const totalKes = Number(data.totalKes ?? 0);

  const pricingHtml = totalKes > 0
    ? `
      <p><strong>Subtotal:</strong> KES ${subtotalKes.toLocaleString()}</p>
      ${discountKes > 0 ? `<p><strong>Discount:</strong> -KES ${discountKes.toLocaleString()}${promoCode ? ` (${promoCode})` : ""}</p>` : ""}
      <p><strong>Total:</strong> KES ${totalKes.toLocaleString()}</p>
    `
    : "";

  switch (templateName) {
    case "booking-inquiry-received":
      return {
        to: data.recipientEmail,
        subject: `We've received your stay request · ${SITE_NAME}`,
        html: `
          <h2>Karibu, ${name}.</h2>
          <p>Your stay request has reached us. We'll confirm the details personally within a few hours.</p>
          <p><strong>${podName}</strong><br>${checkIn} → ${checkOut}<br>${adults} adults · ${children} children · ${rooms} room(s)</p>
          ${pricingHtml}
          <p>Check-in 3pm · Check-out 2pm</p>
        `,
      };
    case "booking-inquiry-admin-alert":
      return {
        to: ALERT_EMAIL,
        subject: `New booking inquiry: ${name} · ${podName || "pod"}`,
        html: `
          <h2>New booking inquiry</h2>
          <p><strong>Guest:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>Phone:</strong> ${phone}</p>
          <p><strong>Pod:</strong> ${podName}<br><strong>Dates:</strong> ${checkIn} → ${checkOut}<br><strong>Guests:</strong> ${adults} adults · ${children} children · ${rooms} room(s)</p>
          ${pricingHtml}
          ${notes ? `<p><strong>Notes:</strong><br>${notes}</p>` : ""}
        `,
      };
    case "contact-received":
      return {
        to: data.recipientEmail,
        subject: `We've received your message · ${SITE_NAME}`,
        html: `
          <h2>Asante, ${name}.</h2>
          <p>We've received your note and will get back to you shortly.</p>
          ${message ? `<p><strong>Your message:</strong><br>${message}</p>` : ""}
        `,
      };
    case "contact-admin-alert":
      return {
        to: ALERT_EMAIL,
        subject: `New message from ${name} — ${SITE_NAME}`,
        html: `
          <h2>New contact message</h2>
          <p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>Phone:</strong> ${phone}</p>
          ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ""}
          <p><strong>Message:</strong><br>${message}</p>
        `,
      };
    case "booking-confirmation":
      return {
        to: data.recipientEmail,
        subject: `Your stay is confirmed · ${SITE_NAME}`,
        html: `
          <h2>Karibu sana, ${name}.</h2>
          <p>Your stay at ${SITE_NAME} is confirmed. We can't wait to host you.</p>
          <p><strong>${podName}</strong><br>${checkIn} → ${checkOut}<br>${adults} adults · ${children} children</p>
          ${pricingHtml}
          <p><strong>How to pay:</strong> Pay through Till Number ${PAYMENT_TILL}.</p>
          <p>Check-in is from 3pm and check-out by 2pm. If anything changes, just reply to this email.</p>
        `,
      };
    case "booking-decline":
      return {
        to: data.recipientEmail,
        subject: `An update on your stay request · ${SITE_NAME}`,
        html: `
          <h2>Hello ${name},</h2>
          <p>Asante for your interest in staying with us. Unfortunately, we're unable to confirm your request for the dates below.</p>
          <p><strong>${podName}</strong><br>${checkIn} → ${checkOut}</p>
          <p>Please reply to this email or contact us on ${CONTACT_PHONE} and we'll help with other dates.</p>
        `,
      };
    default:
      return null;
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `${SITE_NAME} <bookings@lera.co.ke>`;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(500).json({ error: "Email is not configured" });
  }

  const { templateName, recipientEmail, templateData = {} } = req.body || {};
  const email = renderTemplate(templateName, { ...templateData, recipientEmail });

  if (!email?.to) {
    return res.status(400).json({ error: "Email recipient is missing" });
  }

  if (!email) {
    return res.status(400).json({ error: "Unknown email template" });
  }

  const transportOptions = [
    {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
    },
    ...(smtpPort === 465
      ? [{ host: smtpHost, port: 587, secure: false }]
      : [{ host: smtpHost, port: 465, secure: true }]),
  ];

  try {
    let lastError = null;

    for (const option of transportOptions) {
      try {
        const transporter = nodemailer.createTransport({
          ...option,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 12000,
          greetingTimeout: 12000,
          socketTimeout: 15000,
        });

        await transporter.sendMail({
          from: smtpFrom,
          to: email.to,
          replyTo: smtpUser,
          subject: email.subject,
          html: email.html,
        });

        return res.status(200).json({ success: true, port: option.port });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Email send failed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    return res.status(500).json({ error: message });
  }
}
