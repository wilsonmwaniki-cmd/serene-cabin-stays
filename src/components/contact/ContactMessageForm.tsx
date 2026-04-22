import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

const normalizeName = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            .split("'")
            .map((piece) => piece ? `${piece.charAt(0).toUpperCase()}${piece.slice(1).toLowerCase()}` : piece)
            .join("'")
        )
        .join("-")
    )
    .join(" ");

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(5, "Please enter first and last name")
    .max(120)
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Please enter first and last name"),
  email: z.string().trim().email("Please enter a valid email you can access").max(255),
  phone: z
    .string()
    .trim()
    .min(10, "Phone number is required")
    .max(20, "Please enter a valid phone number")
    .regex(/^\+?[0-9\s()-]{10,20}$/, "Please enter a valid phone number"),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(5, "Please include a short message").max(2000),
});

export const ContactMessageForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeName(name);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const parsed = schema.safeParse({ name: normalizedName, email: normalizedEmail, phone: normalizedPhone, subject, message });
    if (!parsed.success) {
      toast({ title: "Please review the form", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setName(normalizedName);
    setEmail(normalizedEmail);
    setPhone(normalizedPhone);
    setSubmitting(true);
    const id = crypto.randomUUID();
    const payload = {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      subject: subject.trim() || null,
      message: message.trim(),
    };
    const { error } = await supabase.from("messages").insert({ id, ...payload });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }

    // Fire-and-forget guest confirmation + admin alert
    supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "contact-received",
        recipientEmail: payload.email,
        idempotencyKey: `contact-received-${id}`,
        templateData: { name: payload.name, message: payload.message },
      },
    }).catch(() => {});
    supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "contact-admin-alert",
        idempotencyKey: `contact-admin-${id}`,
        templateData: payload,
      },
    }).catch(() => {});

    setDone(true);
    toast({ title: "Message received", description: "We'll get back to you shortly." });
  };

  if (done) {
    return (
      <div className="text-center py-10 px-6 bg-bone border border-border">
        <div className="mx-auto w-12 h-12 rounded-full bg-sage-deep text-bone flex items-center justify-center mb-4">
          <Check size={22} />
        </div>
        <h3 className="font-display text-2xl text-sage-deep mb-2">Message sent</h3>
        <p className="text-muted-foreground max-w-md mx-auto">Thank you — we've received your note and will reply soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Your Name">
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setName((current) => normalizeName(current))} className="w-full bg-transparent text-base outline-none" placeholder="First and last name" required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="you@example.com" required />
        </Field>
        <Field label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="+254..." required />
        </Field>
        <Field label="Subject (optional)">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-transparent text-base outline-none" placeholder="A quick question" />
        </Field>
      </div>
      <Field label="Message">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-transparent text-base outline-none resize-y min-h-[120px]" placeholder="How can we help?" required />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-sage-deep hover:bg-sage text-bone py-4 text-sm uppercase tracking-[0.2em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block bg-bone border border-border px-4 py-3">
    <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);
